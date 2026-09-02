// Zustand：一个 project + 所有动作。不做持久化，刷新回到初始状态。
import { create } from 'zustand'
import type {
  AnalysisStep, AssetKind, CandidateAsset, Episode, Look, MountRef,
  Project, PromptState, Scene, Shot, ShotDensity, Stage,
} from '../data/types'
import { seedProject, seedFreshProject, seedCandidates, emptyProject } from '../data/seed'
import {
  commitCandidates as commitCandidatesSvc,
  extractCandidates,
  type ScannedAsset,
} from '../services/candidates'
import { episode2Payload, ep2Episode, type EpisodePayload } from '../data/seedEpisode2'
import { fillEpisode } from '../services/incremental'
import { DENSITY_LABEL, densityShots, hasDensityPresets, resplitSceneDensity } from '../services/density'
import { deleteEpisode as deleteEpisodeSvc, resplitScene } from '../services/lock'
import { can } from '../services/capability'
import { buildUsageIndex, type AssetUsage } from '../services/appearanceIndex'
import { unreferencedCount as countUnreferenced } from '../services/reference'
import { deliverFirstBatch, shotsAffectedByAsset } from '../services/staleness'
import { lookName } from '../services/looks'
import { sceneDuration } from '../services/timeline'
import type { ViewScope } from '../services/viewScope'
import { applyDecisions, type Decision } from '../components/decision'

// 出场索引：按 project 引用记忆化。project 是不可变替换的，引用变才重算（决策 2.3）。
let _idxProject: Project | null = null
let _idx: Record<string, AssetUsage> = {}
function usageIndexOf(project: Project): Record<string, AssetUsage> {
  if (_idxProject !== project) {
    _idxProject = project
    _idx = buildUsageIndex(project)
  }
  return _idx
}

export type Tab = 'character' | 'costume' | 'location' | 'prop' | 'shot'

/** 上传演示的呈现相位（v2.5 §三）。三个「中」相位各对应一段整页动效，且**各跨一步**：
 *    organizing → 跑完落整理剧本页（步骤①）
 *    extracting → 跑完落资产确认页（步骤②）
 *    splitting  → 跑完落分镜表（步骤③）
 *  动效页属于**目标**步骤：点下「进入下一步」的瞬间 analysisStep 就已经切过去了，
 *  步骤条立刻响应，动效是下一步在干活。
 *  纯 UI 态，不进领域模型。seed 始终完整加载，动画只做呈现层揭示。
 *  与 AnalysisStep（现在在三步的哪一步）正交，不要合并。 */
export type AnalysisPhase = 'empty' | 'organizing' | 'extracting' | 'splitting' | 'done'

export interface ToastAction {
  label: string
  run: () => void
}

export interface Toast {
  id: number
  text: string
  action?: ToastAction
}

// 追加/替换第 2 集时「本次范围内 AI 抽到的资产」。着装角色由 appendEpisode 处理，不进候选闸。
const EP2_SCANNED: ScannedAsset[] = episode2Payload.assets
  .filter((a) => a.kind !== 'look')
  .map((a) => ({ kind: a.kind, name: a.name, imagePrompt: a.imagePrompt, aliases: a.aliases }))

// 手动新建的集（v2.5 §5.3）没有任何 seed 数据可对照。拆分时给它建**一个**空场：
// 场名 = 集名，原文 = 集正文，镜头留空——分镜表里那一场是空态，用「插入镜头」手动补。
const isManualEpisode = (id: string) => id.startsWith('e_manual_')

function manualScene(ep: Episode, density: ShotDensity): Scene {
  return {
    id: `sc_${ep.id}`, episodeId: ep.id, no: 1,
    name: ep.title, location: '', timeOfDay: '',
    rawText: ep.rawText, shotIds: [], density, track: { mood: '', bgm: '' },
  }
}

/** 给所有「已提取、还没有场」的手动集各建一个空场。返回新的 project（无手动集则原样返回）。 */
function withManualScenes(project: Project): Project {
  const targets = project.episodes.filter((e) => e.sceneIds.length === 0 && isManualEpisode(e.id))
  if (!targets.length) return project
  const scenes = { ...project.scenes }
  const episodes = project.episodes.map((e) => {
    if (e.sceneIds.length > 0 || !isManualEpisode(e.id)) return e
    const sc = manualScene(e, project.defaultDensity)
    scenes[sc.id] = sc
    return { ...e, sceneIds: [sc.id] }
  })
  return { ...project, episodes, scenes }
}

interface UIState {
  activePage: Stage
  /** 步骤③ 左侧目录的视图作用域（v2.7 §5.2）：全剧 / 本集 / 本场。纯 UI 态。 */
  viewScope: ViewScope
  /** 「本场剧本」面板与场级设定抽屉正对着哪一场。视图作用域是集 / 全剧时，它指向范围内第一场。 */
  selectedSceneId: string
  activeTab: Tab
  scriptOpen: boolean
  sceneSettingsOpen: boolean
  navCollapsed: boolean
  toast: Toast | null
  // ── 拆解过程演示 ──
  analysisPhase: AnalysisPhase
  /** 节奏弹窗里选中的档位，只在「确认 → 动效跑完」之间活着（v2.5 §三）。 */
  pendingDensity: ShotDensity | null
  /** 增量确认时同批带过去的候选处理方式；null = 本次是首次拆分，不是增量。 */
  pendingDecisions: Record<string, Decision> | null
  // ── 可拖拽面板宽度：集·场目录 / 本场剧本（展开时）。右侧大区吃剩余空间。──
  episodeW: number
  scriptW: number
  // 从「出场明细」跳转过来时，短暂高亮的镜头 id（分镜表里泛一下光后自动消退）。
  flashShotIds: string[]
  /** 当前 hover 到的「某镜的某个实体词」。hover 主要内容里的名字时写入。
   *  带 shotId 是为了把高亮**限定在本行** —— 一个角色往往整场每镜都在，
   *  不限定的话 hover 一个名字会让全场的角色卡一起亮，那就不是联动而是噪音了。
   *  另外它只驱动「出场的人和物」这一列，不驱动左侧剧本原文面板（那是彩色区，自己已在标实体）。 */
  hoverMention: { assetId: string; shotId: string } | null
  /** 阶段② 悬浮到某条候选/已入库资产时，左侧全剧原文点亮它的名字（terms = [name, ...aliases]）。
   *  与 hoverMention 是两回事：那个带 shotId、服务分镜表；这个只有资产身份的名字数组，
   *  因为阶段② 的候选没有稳定 id 可供左栏反查，用名字最直接。 */
  hoverAssetTerm: { terms: string[] } | null
}

// 面板宽度夹取范围。
export const PANEL_MIN = { episode: 150, script: 200 }
export const PANEL_MAX = { episode: 380, script: 620 }

export interface StoreState extends UIState {
  project: Project

  /** 提示词生成状态：shotId → PromptState。第一眼全部 pending，需点「生成全部提示词」。
   *
   *  **这两张表是惰性的：缺键即默认值**（promptStates 缺键 = 'pending'，promptEdited 缺键 = false）。
   *  所以结构性改动后不需要把它们「对齐」到新的镜头集合——以前每个改 project 的动作
   *  都要记得跟一句 reconcilePrompts()，漏一处就是新镜头没有状态，那是一类必然会犯的错。
   *  真正需要清键的只有删镜 / 删场，它们本来就在各自的动作里显式 delete。 */
  promptStates: Record<string, PromptState>

  /** 镜头提示词是否被手动编辑过。与 promptStates 是两个正交维度：
   *  一个镜头可以同时是「已手动编辑」和「待更新」。UI 态，不进 Shot 数据模型。 */
  promptEdited: Record<string, boolean>

  // ── 候选层与确认闸（v2.0）──
  /** 流程相位：分镜是否已经存在。与 analysisPhase（动画）正交。 */
  analysisStep: AnalysisStep
  /** 待确认候选。空数组 = 没有待处理增量。 */
  candidates: CandidateAsset[]

  usageIndex: () => Record<string, AssetUsage>
  countShotsOf: (assetId: string) => number

  // ── UI 动作 ──
  toggleNav: () => void
  setPage: (page: Stage) => void
  selectScene: (sceneId: string) => void
  setViewScope: (scope: ViewScope) => void
  setTab: (tab: Tab) => void
  toggleScript: () => void
  openSceneSettings: () => void
  closeSceneSettings: () => void
  showToast: (text: string, action?: ToastAction) => void
  dismissToast: () => void

  // ── 步骤① 整理剧本（v2.5 §五）──
  /** 空态上传弹窗点「开始整理」：进 organizing，跑整页动效。 */
  beginOrganize: () => void
  /** 整理跑完：落到「整理完毕、还没提取」的起点，进整理剧本页。 */
  finishOrganize: () => void
  /** 「上传文件 · 解析新集」弹窗跑完：往集列表末尾接一个只有原文、没有场镜的草稿集。 */
  supplementScript: () => void
  /** ⋯ 菜单「新建一集」：追加一个空白草稿集，正文由用户自己敲。 */
  createBlankEpisode: () => void
  /** 手动集的正文录入（textarea 失焦时写回，字数按去空白后的字符数算）。 */
  setEpisodeText: (episodeId: string, text: string) => void
  renameEpisode: (episodeId: string, title: string) => void
  /** 删除一个还没提取过资产的集（有锁的集不动）。 */
  deleteDraftEpisode: (episodeId: string) => void
  /** 把一个无锁集并进上一集：原文拼接、字数相加、集号顺延。 */
  mergeEpisodeUp: (episodeId: string) => void
  /** 页脚主按钮「确认集数并提取资产」：**步骤条瞬间到②** + 进 extracting 跑整页动效。 */
  startExtract: () => void
  /** 提取跑完：草稿集上锁 + 抽候选 → 步骤②（无新候选则直接拆分进步骤③）。 */
  finishExtract: () => void
  /** 节奏弹窗点「确认并开始拆分」：未入库先入库，**步骤条瞬间到③** + 进 splitting。
   *  decisions 只在已入库的增量场景传，它同时也是「本次是增量」的判据。 */
  beginSplit: (density: ShotDensity, decisions?: Record<string, Decision>) => void
  /** 拆分动效跑完：首次走 startSplit，增量走 confirmIncremental。 */
  finishSplit: () => void
  /** 步骤②（已入库后）的主按钮：结算新候选 + 给草稿集补场镜 → 步骤③。 */
  confirmIncremental: (decisions: Record<string, Decision>) => void
  setAnalysisPhase: (phase: AnalysisPhase) => void
  /** 流程条跳转用：切阶段② / 阶段③ 相位（其余相位切换各有专用入口，不走这里）。 */
  setAnalysisStep: (step: AnalysisStep) => void
  // 拖拽调整面板宽度（自动夹取到 PANEL_MIN/MAX）。
  setPanelW: (which: 'episode' | 'script', width: number) => void
  // 「重新演示」：复位到空态，并把工作区视图复位（第 1 场 / 分镜 tab / 收起剧本）。
  replayDemo: () => void

  // ── 提示词生成（两步式：先生成全部提示词，再生成第一批图）──
  generatePrompts: (shotIds: string[]) => void
  // 直接置某镜提示词状态（弹窗里手动写完提示词后，把 pending 提为 ready）。
  setPromptState: (shotId: string, state: PromptState) => void
  // 标记某镜提示词被手动编辑过（ShotPromptDialog 手动改写并保存时调用）。
  markPromptEdited: (shotId: string) => void

  // ── 数据动作（受能力矩阵 can(project, cap) 约束）──
  updateShotField: (shotId: string, field: keyof Shot, value: string) => void
  setShotDuration: (shotId: string, duration: number) => void
  // 在某场的第 index 个位置（0-based，插在该位置之前）插入一个空镜头，并顺延重编号。
  insertShot: (sceneId: string, index: number) => void
  // 在某集的第 index 个位置插入一个空场，并顺延重编号。
  insertScene: (episodeId: string, index: number) => void
  // 改场名（双击场名就地编辑，失焦/回车自动保存）。清空则回落到「（未命名）」。
  renameScene: (sceneId: string, name: string) => void
  // 删除一个场（级联删镜 + 清理只在本场出现的孤儿资产 + 顺延重编号）。调用方需先做二次确认。
  deleteScene: (sceneId: string) => void
  // 删除一个镜头（顺延重编号）。调用方需先做二次确认。
  deleteShot: (shotId: string) => void
  addMount: (shotId: string, mount: MountRef) => void
  removeMount: (shotId: string, assetId: string) => void
  updateSceneTrack: (sceneId: string, patch: Partial<Project['scenes'][string]['track']>) => void
  updateAssetPrompt: (assetId: string, text: string) => void
  setHoverMention: (m: { assetId: string; shotId: string } | null) => void
  setHoverAssetTerm: (t: { terms: string[] } | null) => void
  // ── 造型手动挂载（v2.0，受 editLookBinding 约束）──
  /** 改某着装角色引用的服装集合。挂载的镜头视觉随之变化 → 标待更新。 */
  setLookCostumes: (lookId: string, costumeIds: string[]) => void
  /** 为角色新建一个着装角色（look）。返回新 look 的 id，失败返回空串。 */
  createLook: (characterId: string, costumeIds: string[]) => string
  deleteEpisode: (episodeId: string) => void
  setStage: (stage: Stage) => void

  renameCandidate: (tempId: string, name: string) => void
  addManualCandidate: (kind: AssetKind, name: string) => void
  removeCandidate: (tempId: string) => void
  /** 阶段② 直接改一条候选的生图提示词。 */
  setCandidatePrompt: (tempId: string, text: string) => void
  /** 「✦ AI 结合剧本补全」：为提示词为空的候选生成一版草案（演示，纯前端合成）。 */
  completeCandidatePrompt: (tempId: string) => void
  /** 挂一件服装 = 生成一套造型 + 一条占位融合提示词（阶段② §3.3）。 */
  attachCandidateCostume: (charTempId: string, costumeId: string) => void
  /** 解除某套造型：移除该服装与它的提示词。 */
  detachCandidateCostume: (charTempId: string, costumeId: string) => void
  /** 行内编辑某套造型的融合提示词。 */
  setCandidateLookPrompt: (charTempId: string, costumeId: string, text: string) => void
  /** 「✦ AI 结合剧本补全」某套造型的融合提示词（演示：纯前端合成，同步落字）。 */
  completeCandidateLookPrompt: (charTempId: string, costumeId: string) => void

  // ── 统一任务弹窗（v2.2 §4）：把「预检查」与「执行」拆开，让每个任务弹窗内联跑，不再另开闸弹窗 ──
  /** 纯函数：给定本次扫到的资产，返回尚未收录的候选（不改 store）。供 <AssetPrecheck> 调用。 */
  previewCandidates: (scanned: ScannedAsset[]) => CandidateAsset[]
  /** 结算一组已定好处理方式的候选到项目资产库（link 写别名）。不挂任务、不发 toast。 */
  commitScanned: (cands: CandidateAsset[]) => void
  scannedForEp2: () => ScannedAsset[]
  /** 直接执行任务（不走闸；候选已由弹窗内联结算）。带各自的结果 toast。 */
  runResplitScene: (sceneId: string, opts: { density?: ShotDensity; targetShots?: number }) => void
  runResplitEpisode: (episodeId: string, opts: { density: ShotDensity; sceneCount?: number }) => void

  /** 「确认并保存到项目资产库」：结算候选 + 写 libraryCommittedAt。 */
  commitLibrary: () => void
  /** 步骤③「开始拆分」：为已提取、还没有场的集**创建场并填镜**，analysisStep → 'storyboard'。 */
  startSplit: (opts: { density?: ShotDensity; instant?: boolean }) => void

  // ── 资产库侧（v3 唯一的删除出口）──
  deleteAsset: (assetId: string) => void
}

let toastSeq = 0

// 提示词「逐镜揭示」的计时器。**一个** interval 分批推进，而不是一镜一个 setTimeout：
// 25 镜曾经是 25 个定时器、25 次 set，每次都触发一遍全表重渲染（连带每行重算挂载提示）。
// 现在把揭示帧数封顶，镜头再多也只重渲染这么多次；总时长与原来保持一致。
const REVEAL_MAX_TICKS = 12
let revealTimer: ReturnType<typeof setInterval> | undefined
const stopReveal = () => {
  if (revealTimer !== undefined) {
    clearInterval(revealTimer)
    revealTimer = undefined
  }
}
// 插入用的自增序号，保证新场 / 新镜 id 唯一，不与 seed 的 `s1_sh1` 命名撞车。
let insSeq = 0

/** targetShots → 在三套预设里选镜数最接近 N 的那套。 */
function closestDensity(sceneId: string, target: number): ShotDensity {
  const cands: ShotDensity[] = ['compact', 'standard', 'loose']
  return cands.reduce((best, d) =>
    Math.abs(densityShots(sceneId, d).length - target) <
    Math.abs(densityShots(sceneId, best).length - target)
      ? d
      : best,
  )
}



export const useStore = create<StoreState>((set, get) => {
  // 改了某镜的「第一步字段 / 挂载」→ 若该镜提示词已就绪则落回 stale，并提示重新生成。
  const touchPrompt = (shotId: string, notify = true) => {
    if (get().promptStates[shotId] !== 'ready') return
    set((s) => ({ promptStates: { ...s.promptStates, [shotId]: 'stale' } }))
    if (notify) {
      get().showToast('已保存，提示词待更新')
    }
  }

  // ── 续跑体（v2.0）──
  // 每个改剧本的操作把「真正落库/生成分镜」的那一段抽成 apply*，供两条路径复用：
  //   · 零候选：入口动作 → openIncrementalGate 直接跑 apply*
  //   · 有候选：入口动作 → 开闸 → 用户确认 → commitCandidates → runPendingTask → apply*
  // 这样「先确认后续跑」与「无候选不打断」用同一份续跑逻辑，不分叉。

  // 第 2 集的镜头挂载写的是 seed 资产 id（A.suke / A.living…）。
  // 但走过「首次导入」的项目里，那些资产是从候选入的库，id 已经变成 committed 形态
  //（`as_${seedId}`，着装角色 `lk_as_${characterId}`）——直接并进来会挂到不存在的 id 上，
  // 分镜表里就是一排「已失效」。所以并集之前按库里**实际存在**的 id 就近解析一次；
  // 从 seedProject 起步（资产还是 seed id）的演示路径下这一步是恒等映射，不改变任何东西。
  const ep2PayloadFor = (project: Project): EpisodePayload => {
    const resolve = (assetId: string): string => {
      if (project.assets[assetId]) return assetId
      const a = seedProject.assets[assetId]
      if (!a) return assetId
      const committed = a.kind === 'look' ? `lk_as_${a.characterId}` : `as_${assetId}`
      return project.assets[committed] ? committed : assetId
    }
    const shots: Record<string, Shot> = {}
    for (const [id, sh] of Object.entries(episode2Payload.shots)) {
      shots[id] = { ...sh, mounts: sh.mounts.map((m) => ({ kind: m.kind, assetId: resolve(m.assetId) })) }
    }
    return { ...episode2Payload, shots }
  }

  // 给「已有原文、还没有场镜」的草稿集补上场与镜。
  // 走 fillEpisode 的「只补场镜」分支，集的标题 / 原文 / 字数 / 锁一个字节都不动。
  const fillDraftEpisodes = () => {
    const s = get()
    const hasEp2Draft = s.project.episodes.some((e) => e.sceneIds.length === 0 && e.id === 'e2')
    const hasManual = s.project.episodes.some((e) => e.sceneIds.length === 0 && isManualEpisode(e.id))
    if (!hasEp2Draft && !hasManual) return
    const filled = hasEp2Draft ? fillEpisode(s.project, ep2PayloadFor(s.project)) : s.project
    const next = withManualScenes(filled)
    // 选中刚补完场的那一集的第一场（e2 优先，否则取本次新得到场的那一集）。
    const had = new Set(s.project.episodes.filter((e) => e.sceneIds.length > 0).map((e) => e.id))
    const first =
      next.episodes.find((e) => e.id === 'e2' && e.sceneIds.length > 0)?.sceneIds[0] ??
      next.episodes.find((e) => e.sceneIds.length > 0 && !had.has(e.id))?.sceneIds[0] ??
      s.selectedSceneId
    set({
      project: next,
      analysisStep: 'storyboard',
      activeTab: 'shot',
      selectedSceneId: first,
      sceneSettingsOpen: false,
    })
  }

  const applyResplitScene = (sceneId: string, opts: { density?: ShotDensity; targetShots?: number }) => {
    const s = get()
    const scene = s.project.scenes[sceneId]
    if (!scene) return

    // 该场没有多套预设 → 回退到「恢复初始」。
    if (!hasDensityPresets(sceneId)) {
      const reset = resplitScene(s.project, sceneId)
      const rscene = reset.scenes[sceneId]!
      const next = { ...reset, scenes: { ...reset.scenes, [sceneId]: { ...rscene, density: 'standard' as ShotDensity } } }
      set({ project: next, sceneSettingsOpen: false })
      get().showToast('当前演示仅第 1 场支持不同镜头节奏，本场已按原方式重新生成')
      return
    }

    // 指定镜数 → 选最接近的一套，如实说明。
    if (opts.targetShots != null && opts.density == null) {
      const density = closestDensity(sceneId, opts.targetShots)
      const next = resplitSceneDensity(s.project, sceneId, density)
      set({ project: next, sceneSettingsOpen: false })
      get().showToast(
        `已按「期望 ${opts.targetShots} 个镜头」重新拆分：当前演示中最接近的方案为「${DENSITY_LABEL[density]}」，共 ${densityShots(sceneId, density).length} 个镜头`,
      )
      return
    }

    // 指定颗粒度（或照原颗粒度重拆一次）。
    const density = opts.density ?? scene.density
    const next = resplitSceneDensity(s.project, sceneId, density)
    set({ project: next, sceneSettingsOpen: false })
    get().showToast(`「${scene.name}」已按${DENSITY_LABEL[density]}节奏重新拆分为 ${densityShots(sceneId, density).length} 个镜头，其他场景没有改变。`)
  }

  const applyResplitEpisode = (episodeId: string, opts: { density: ShotDensity; sceneCount?: number }) => {
    const s = get()
    let proj = s.project
    const ep = proj.episodes.find((e) => e.id === episodeId)
    if (!ep) return

    const applied: string[] = []
    const kept: number[] = []
    for (const sid of ep.sceneIds) {
      const scene = proj.scenes[sid]
      if (!scene) continue
      if (hasDensityPresets(sid)) {
        proj = resplitSceneDensity(proj, sid, opts.density)
        applied.push(`第 ${scene.no} 场按${DENSITY_LABEL[opts.density]}节奏重新拆分为 ${proj.scenes[sid]!.shotIds.length} 个镜头`)
      } else {
        const reset = resplitScene(proj, sid)
        const rscene = reset.scenes[sid]!
        proj = { ...reset, scenes: { ...reset.scenes, [sid]: { ...rscene, density: 'standard' as ShotDensity } } }
        kept.push(scene.no)
      }
    }
    set({
      project: proj,
      selectedSceneId: ep.sceneIds[0] ?? s.selectedSceneId,
      sceneSettingsOpen: false,
    })

    let msg = applied.length
      ? `已重新拆分第 ${ep.no} 集：${applied.join('，')}`
      : `已重新拆分第 ${ep.no} 集`
    if (kept.length) msg += `，第 ${kept.join(' / ')} 场当前演示无多套方案，保持原方式`
    if (opts.sceneCount != null) msg += '；当前版本暂不支持调整场景数量'
    get().showToast(msg)
  }

  return {
  // 进站起点是**空项目**（v2.6 §1.2）：没有集、没有场镜、没有资产、未入库。
  // 从前这里是 seedProject（一个「全做完了」的项目），步骤条据此把 ② ③ 打上 ✓，
  // 而用户此刻连剧本都还没上传。
  project: structuredClone(emptyProject),
  promptStates: {},
  promptEdited: {},
  activePage: 'analysis',
  viewScope: { kind: 'project' },
  selectedSceneId: 's1',
  activeTab: 'shot',
  scriptOpen: false,
  sceneSettingsOpen: false,
  navCollapsed: false,
  toast: null,
  // 进站默认空态：先看到空剧本页，点「＋ 上传剧本」才开始演示。
  analysisPhase: 'empty',
  pendingDensity: null,
  pendingDecisions: null,
  episodeW: 192,
  scriptW: 308,
  flashShotIds: [],
  hoverMention: null,
  hoverAssetTerm: null,
  // 候选层：默认从现状起（已入库 + 有分镜），故 storyboard、无候选、无挂起任务。
  analysisStep: 'storyboard',
  candidates: [],

  usageIndex: () => usageIndexOf(get().project),
  // 镜数读派生索引（含 look 向角色 / 服装的向上聚合），不再每次遍历 shots。
  countShotsOf: (assetId) => usageIndexOf(get().project)[assetId]?.shotCount ?? 0,

  toggleNav: () => set((s) => ({ navCollapsed: !s.navCollapsed })),
  setPage: (activePage) => set({ activePage }),
  // 把「本场剧本」面板 / 场级设定抽屉指向某一场，**不改视图作用域**（v2.7 §5.2）——
  // 在全剧视图里点某个场区块的「场级设定」，不该顺手把表格收窄到那一场。
  // 真要切视图走 setViewScope，它会顺带把 selectedSceneId 带过去。
  selectScene: (sceneId) => set({ selectedSceneId: sceneId, sceneSettingsOpen: false }),
  // 切视图（v2.7 §5.2）：selectedSceneId 跟着落到范围内第一场——
  // 「本场剧本」面板与场级设定抽屉永远得有一个明确的对象，哪怕表格铺的是全剧。
  setViewScope: (scope) => {
    const p = get().project
    const firstOf = (ids: string[]) => ids.find((id) => p.scenes[id])
    const target =
      scope.kind === 'scene'
        ? scope.sceneId
        : scope.kind === 'episode'
          ? firstOf(p.episodes.find((e) => e.id === scope.episodeId)?.sceneIds ?? [])
          : firstOf(p.episodes.flatMap((e) => e.sceneIds))
    set({
      viewScope: scope,
      selectedSceneId: target ?? get().selectedSceneId,
      sceneSettingsOpen: false,
    })
  },
  setTab: (activeTab) => set({ activeTab }),
  toggleScript: () => set((s) => ({ scriptOpen: !s.scriptOpen })),
  openSceneSettings: () => set({ sceneSettingsOpen: true }),
  closeSceneSettings: () => set({ sceneSettingsOpen: false }),
  showToast: (text, action) => {
    const id = ++toastSeq
    set({ toast: { id, text, action } })
  },
  dismissToast: () => set({ toast: null }),

  // ── 步骤① 整理剧本（v2.5 §五）──
  // 上传弹窗点「开始整理」 → 关窗 → 整页动效（FullPageProcess 跑完调 finishOrganize）。
  // 没有确认花费弹窗、没有价格：上传 / 研读 / 拆集都免费，整理剧本页本身就是那份预估结果。
  beginOrganize: () => set({ analysisPhase: 'organizing' }),

  finishOrganize: () => set({
    project: structuredClone(seedFreshProject),
    candidates: [],
    promptStates: {},
    promptEdited: {},
    analysisStep: 'episodes',
    analysisPhase: 'done',
    hoverAssetTerm: null,
    sceneSettingsOpen: false,
  }),

  supplementScript: () => {
    const s = get()
    if (s.project.episodes.some((e) => e.id === 'e2')) return
    // 草稿集：只有原文与字数，没有场镜、没有锁。场镜要等它自己那一轮提取 + 拆分。
    const draft = { ...structuredClone(ep2Episode), sceneIds: [] }
    delete draft.extractedAt
    set({ project: { ...s.project, episodes: [...s.project.episodes, draft] } })
  },

  // 新建一集（v2.5 §5.3）：只做到「能输文字、能算字数」。不做富文本、不做自动拆场——
  // 它的场要等步骤③ 拆分时补一个空场出来（见 manualScene）。
  createBlankEpisode: () => {
    const s = get()
    const no = s.project.episodes.length + 1
    const ep: Episode = {
      id: `e_manual_${no}`, no, title: '未命名', rawText: '', wordCount: 0, sceneIds: [],
    }
    set({ project: { ...s.project, episodes: [...s.project.episodes, ep] } })
  },

  setEpisodeText: (episodeId, text) => {
    set((st) => ({
      project: {
        ...st.project,
        episodes: st.project.episodes.map((e) =>
          e.id === episodeId ? { ...e, rawText: text, wordCount: text.replace(/\s/g, '').length } : e,
        ),
      },
    }))
  },

  renameEpisode: (episodeId, title) => {
    const trimmed = title.trim()
    if (!trimmed) return
    set((st) => ({
      project: {
        ...st.project,
        episodes: st.project.episodes.map((e) => (e.id === episodeId ? { ...e, title: trimmed } : e)),
      },
    }))
  },

  deleteDraftEpisode: (episodeId) => {
    const s = get()
    const ep = s.project.episodes.find((e) => e.id === episodeId)
    if (!ep || ep.extractedAt) return
    const episodes = s.project.episodes
      .filter((e) => e.id !== episodeId)
      .map((e, i) => ({ ...e, no: i + 1 }))
    set({ project: { ...s.project, episodes } })
    get().showToast(`已删除「${ep.title}」。`)
  },

  mergeEpisodeUp: (episodeId) => {
    const s = get()
    const idx = s.project.episodes.findIndex((e) => e.id === episodeId)
    const cur = s.project.episodes[idx]
    const prev = s.project.episodes[idx - 1]
    if (!cur || !prev || cur.extractedAt) return
    const merged = {
      ...prev,
      rawText: `${prev.rawText}\n\n${cur.rawText}`,
      wordCount: prev.wordCount + cur.wordCount,
    }
    const episodes = s.project.episodes
      .filter((e) => e.id !== episodeId)
      .map((e) => (e.id === prev.id ? merged : e))
      .map((e, i) => ({ ...e, no: i + 1 }))
    set({ project: { ...s.project, episodes } })
    get().showToast(`已并入「${prev.title}」，现共 ${merged.wordCount.toLocaleString()} 字。`)
  },

  // 步骤条在点下去的瞬间就切到②（v2.5 §2.2）：用户点的是「进入下一步」，
  // 动效是下一步在干活，不该还停在①。
  startExtract: () => set({ analysisPhase: 'extracting', analysisStep: 'assetConfirm' }),

  finishExtract: () => {
    const s = get()
    const committed = s.project.libraryCommittedAt != null
    // 已入库（补充剧本之后）走判重：库里有的自动滤掉；首次则整份候选清单都要确认。
    const candidates = committed
      ? get().previewCandidates(get().scannedForEp2())
      : structuredClone(seedCandidates)
    const at = Date.now()
    const draftNos = s.project.episodes.filter((e) => !e.extractedAt).map((e) => e.no)
    const project = {
      ...s.project,
      episodes: s.project.episodes.map((e) => (e.extractedAt ? e : { ...e, extractedAt: at })),
    }

    // 已入库且这一集没抽出任何新资产：没有要确认的东西，别为了走流程而停一页。
    if (committed && candidates.length === 0) {
      set({ project, candidates: [], analysisPhase: 'done' })
      fillDraftEpisodes()
      get().showToast(`第 ${draftNos.join(' / ')} 集未发现新资产，已直接拆分`)
      return
    }

    set({
      project,
      candidates,
      analysisStep: 'assetConfirm',
      activeTab: 'character',
      analysisPhase: 'done',
      hoverAssetTerm: null,
    })
  },

  beginSplit: (density, decisions) => {
    // 首次拆分：入库这一下没有单独的确认页，它和拆分是同一个决定，在这里一起做掉。
    if (get().project.libraryCommittedAt == null) get().commitLibrary()
    set({
      analysisPhase: 'splitting',
      analysisStep: 'storyboard',
      pendingDensity: density,
      pendingDecisions: decisions ?? null,
    })
  },

  finishSplit: () => {
    const s = get()
    // pendingDecisions 非空 = 本次是「已入库 + 新集」的增量结算；否则是首次整本拆分。
    if (s.pendingDecisions) get().confirmIncremental(s.pendingDecisions)
    else get().startSplit({ density: s.pendingDensity ?? s.project.defaultDensity })
    set({ analysisPhase: 'done', pendingDensity: null, pendingDecisions: null })
  },

  confirmIncremental: (decisions) => {
    const s = get()
    get().commitScanned(applyDecisions(s.candidates, decisions))
    set({ candidates: [] })
    const before = Object.keys(get().project.shots).length
    fillDraftEpisodes()
    const after = get().project.shots
    const draft = get().project.episodes.find((e) => e.id === 'e2')
    const added = Object.keys(after).length - before
    set({ viewScope: { kind: 'project' } })
    get().showToast(`第 ${draft?.no ?? 2} 集已拆分为 ${added} 个镜头。`)
  },
  setAnalysisPhase: (analysisPhase) => set({ analysisPhase }),
  setAnalysisStep: (analysisStep) => set({ analysisStep }),
  setPanelW: (which, width) => {
    const w = Math.round(Math.min(PANEL_MAX[which], Math.max(PANEL_MIN[which], width)))
    set(which === 'episode' ? { episodeW: w } : { scriptW: w })
  },
  replayDemo: () => {
    stopReveal()
    set({
      // 重新演示 = 回到空项目（v2.6 §1.2）：只复位相位不换 project，步骤条会继续拿着旧数据打 ✓。
      project: structuredClone(emptyProject),
      promptStates: {},
      promptEdited: {},
      analysisPhase: 'empty',
      viewScope: { kind: 'project' },
      selectedSceneId: 's1',
      activeTab: 'shot',
      scriptOpen: false,
      sceneSettingsOpen: false,
      toast: null,
      // 复位首次流程相位，否则「重新演示」之后 analysisStep / candidates / pendingTask 是串的。
      analysisStep: 'episodes',
      candidates: [],
      pendingDensity: null,
      pendingDecisions: null,
      hoverAssetTerm: null,
    })
  },

  // 生成提示词：目标镜置 generating，错峰后置 ready（seed 里已有 image/videoPrompt，生成 = 揭示）。
  generatePrompts: (shotIds) => {
    const cur = get().promptStates
    const targets = shotIds.filter((id) => get().project.shots[id] && cur[id] !== 'generating')
    if (!targets.length) return
    set((s) => {
      const ps = { ...s.promptStates }
      const pe = { ...s.promptEdited }
      targets.forEach((id) => {
        ps[id] = 'generating'
        // 重新生成即覆盖，手动编辑痕迹消失。
        delete pe[id]
      })
      return { promptStates: ps, promptEdited: pe }
    })
    // 总时长沿用原口径（420ms 起步、每镜 220ms），只是把它切成至多 REVEAL_MAX_TICKS 帧。
    stopReveal()
    const totalMs = 420 + (targets.length - 1) * 220
    const ticks = Math.min(targets.length, REVEAL_MAX_TICKS)
    const per = Math.ceil(targets.length / ticks)
    let done = 0
    revealTimer = setInterval(() => {
      const batch = targets.slice(done, done + per)
      done += batch.length
      set((s) => {
        const ps = { ...s.promptStates }
        for (const id of batch) ps[id] = 'ready'
        return { promptStates: ps }
      })
      if (done >= targets.length) {
        stopReveal()
        get().showToast(`已生成 ${targets.length} 镜的画面提示词与视频运动提示词`)
      }
    }, Math.round(totalMs / ticks))
  },

  setPromptState: (shotId, state) => {
    if (!get().project.shots[shotId]) return
    set((s) => ({ promptStates: { ...s.promptStates, [shotId]: state } }))
  },

  markPromptEdited: (shotId) => {
    if (!get().project.shots[shotId]) return
    set((s) => ({ promptEdited: { ...s.promptEdited, [shotId]: true } }))
  },

  updateShotField: (shotId, field, value) => {
    if (!can(get().project, 'editShotFields')) return
    set((s) => {
      const shot = s.project.shots[shotId]
      if (!shot) return s
      return {
        project: { ...s.project, shots: { ...s.project.shots, [shotId]: { ...shot, [field]: value } } },
      }
    })
    // 改的是「第一步字段」才标脏；直接编辑 image/videoPrompt 本身不算内容改动。
    if (field !== 'imagePrompt' && field !== 'videoPrompt') touchPrompt(shotId)
  },

  setShotDuration: (shotId, duration) => {
    if (!can(get().project, 'editShotFields')) return
    const s = get()
    const shot = s.project.shots[shotId]
    if (!shot) return
    const clamped = Math.max(1, Math.round(duration))
    const delta = clamped - shot.duration
    if (delta === 0) return
    const nextShots = { ...s.project.shots, [shotId]: { ...shot, duration: clamped } }
    const scene = s.project.scenes[shot.sceneId]!
    const after = scene.shotIds.slice(scene.shotIds.indexOf(shotId) + 1).length
    set({ project: { ...s.project, shots: nextShots } })
    // 时长只影响时间轴，不改变提示词内容，故不触发「待更新」标脏。
    const newSceneDur = sceneDuration(scene, nextShots)
    get().showToast(
      `第 ${shot.no} 镜已调整为 ${clamped} 秒，本场共 ${newSceneDur} 秒${after > 0 ? '；后续镜头时间已自动更新。' : '。'}`,
    )
  },

  insertShot: (sceneId, index) => {
    if (!can(get().project, 'editShotFields')) return
    set((s) => {
      const scene = s.project.scenes[sceneId]
      if (!scene) return s
      const id = `ins_sh${++insSeq}`
      const blank: Shot = {
        id, sceneId, no: 0, title: '', duration: 3,
        shotSize: '', lens: '', lighting: '', imagePrompt: '',
        cameraMove: '', dialogue: '', sfx: '', videoPrompt: '',
        mounts: [], sourceQuote: '',
      }
      const at = Math.max(0, Math.min(index, scene.shotIds.length))
      const shotIds = [...scene.shotIds]
      shotIds.splice(at, 0, id)
      // 顺延重编号：本场镜号 = 位置 + 1，保证插入后镜号连续。
      const shots: Record<string, Shot> = { ...s.project.shots, [id]: blank }
      shotIds.forEach((sid, i) => {
        const sh = shots[sid]
        if (sh && sh.no !== i + 1) shots[sid] = { ...sh, no: i + 1 }
      })
      return {
        project: { ...s.project, scenes: { ...s.project.scenes, [sceneId]: { ...scene, shotIds } }, shots },
        promptStates: { ...s.promptStates, [id]: 'pending' as PromptState },
      }
    })
    const n = get().project.scenes[sceneId]?.shotIds.length ?? 0
    get().showToast(`已插入 1 个空镜头，本场共 ${n} 镜。填写内容后可生成提示词。`)
  },

  insertScene: (episodeId, index) => {
    if (!can(get().project, 'editScript')) return
    set((s) => {
      const ep = s.project.episodes.find((e) => e.id === episodeId)
      if (!ep) return s
      const id = `ins_sc${++insSeq}`
      const blank: Scene = {
        id, episodeId, no: 0, name: '（未命名）', location: '', timeOfDay: '',
        rawText: '', shotIds: [], density: s.project.defaultDensity, track: { mood: '', bgm: '' },
      }
      const at = Math.max(0, Math.min(index, ep.sceneIds.length))
      const sceneIds = [...ep.sceneIds]
      sceneIds.splice(at, 0, id)
      const episodes = s.project.episodes.map((e) => (e.id === episodeId ? { ...e, sceneIds } : e))
      const scenes = { ...s.project.scenes, [id]: blank }
      // 顺延重编号：本集场号 = 位置 + 1。
      sceneIds.forEach((sid, i) => {
        const sc = scenes[sid]
        if (sc && sc.no !== i + 1) scenes[sid] = { ...sc, no: i + 1 }
      })
      return { project: { ...s.project, episodes, scenes }, selectedSceneId: id, sceneSettingsOpen: false }
    })
    get().showToast('已插入 1 个新场，可导入剧本或重新拆分补充镜头。')
  },

  renameScene: (sceneId, name) => {
    if (!can(get().project, 'editScript')) return
    const trimmed = name.trim() || '（未命名）'
    set((s) => {
      const scene = s.project.scenes[sceneId]
      if (!scene || scene.name === trimmed) return s
      return { project: { ...s.project, scenes: { ...s.project.scenes, [sceneId]: { ...scene, name: trimmed } } } }
    })
  },

  deleteScene: (sceneId) => {
    if (!can(get().project, 'editScript')) return
    const st0 = get()
    const scene = st0.project.scenes[sceneId]
    if (!scene) return
    const ep = st0.project.episodes.find((e) => e.sceneIds.includes(sceneId))
    if (!ep) return
    const epId = ep.id
    const index = ep.sceneIds.indexOf(sceneId)
    const oldNo = scene.no
    const shotIds = [...scene.shotIds]
    const wasSelected = st0.selectedSceneId === sceneId

    // v2.0：删场不动资产库。删除前后各统计一次「未引用」资产数，差值 = 本次新增的未引用项 K。
    const unrefBefore = countUnreferenced(st0.usageIndex())

    set((s) => {
      const e = s.project.episodes.find((x) => x.id === epId)
      if (!e) return s
      const nextSceneIds = e.sceneIds.filter((id) => id !== sceneId)
      const episodes = s.project.episodes.map((x) => (x.id === epId ? { ...x, sceneIds: nextSceneIds } : x))
      const scenes = { ...s.project.scenes }
      delete scenes[sceneId]
      nextSceneIds.forEach((sid, i) => {
        const sc = scenes[sid]
        if (sc && sc.no !== i + 1) scenes[sid] = { ...sc, no: i + 1 }
      })
      const shots = { ...s.project.shots }
      shotIds.forEach((id) => delete shots[id])
      const promptStates = { ...s.promptStates }
      const promptEdited = { ...s.promptEdited }
      shotIds.forEach((id) => {
        delete promptStates[id]
        delete promptEdited[id]
      })
      // 重指选中场：同集就近；本集空了取全剧第一个场；再无则空。
      let selectedSceneId = s.selectedSceneId
      if (wasSelected) {
        if (nextSceneIds.length) selectedSceneId = nextSceneIds[Math.min(index, nextSceneIds.length - 1)]
        else selectedSceneId = episodes.find((x) => x.sceneIds.length > 0)?.sceneIds[0] ?? ''
      }
      // assets 原样透传：删场只删结构与镜头，资产库一条不减（v3 唯一删除出口在资产库侧）。
      return {
        project: { ...s.project, episodes, scenes, shots, assets: s.project.assets },
        promptStates,
        promptEdited,
        selectedSceneId,
        sceneSettingsOpen: false,
      }
    })

    const unrefAfter = countUnreferenced(usageIndexOf(get().project))
    const k = Math.max(0, unrefAfter - unrefBefore)
    get().showToast(
      `已删除第 ${oldNo} 场（${shotIds.length} 个镜头）。项目资产库一条未减，其中 ${k} 项变为「当前剧本未引用」。`,
    )
  },

  // 撤销：单级、随 toast 存活，见改动方案 v1.4 §1（与 renameAssetWithSync 同款）。
  deleteShot: (shotId) => {
    if (!can(get().project, 'editShotFields')) return
    const st0 = get()
    const shot = st0.project.shots[shotId]
    if (!shot) return
    const scene0 = st0.project.scenes[shot.sceneId]
    if (!scene0) return
    const oldNo = scene0.shotIds.indexOf(shotId) + 1

    // 撤销快照：删除镜头会同时动 project / promptStates / promptEdited，三者一起回滚。
    const snapProject = st0.project
    const snapStates = st0.promptStates
    const snapEdited = st0.promptEdited

    set((s) => {
      const scene = s.project.scenes[shot.sceneId]
      if (!scene) return s
      const shotIds = scene.shotIds.filter((id) => id !== shotId)
      const shots = { ...s.project.shots }
      delete shots[shotId]
      shotIds.forEach((sid, i) => {
        const sh = shots[sid]
        if (sh && sh.no !== i + 1) shots[sid] = { ...sh, no: i + 1 }
      })
      const promptStates = { ...s.promptStates }
      delete promptStates[shotId]
      const promptEdited = { ...s.promptEdited }
      delete promptEdited[shotId]
      return {
        project: { ...s.project, scenes: { ...s.project.scenes, [shot.sceneId]: { ...scene, shotIds } }, shots },
        promptStates,
        promptEdited,
      }
    })

    get().showToast(`已删除第 ${oldNo} 镜`, {
      label: '撤销',
      run: () => set({ project: snapProject, promptStates: snapStates, promptEdited: snapEdited }),
    })
  },

  addMount: (shotId, mount) => {
    if (!can(get().project, 'editMounts')) return
    const shot0 = get().project.shots[shotId]
    const willChange = !!shot0 && !shot0.mounts.some((m) => m.assetId === mount.assetId)
    set((s) => {
      const shot = s.project.shots[shotId]
      if (!shot || shot.mounts.some((m) => m.assetId === mount.assetId)) return s
      const mounts = [...shot.mounts, mount]
      return { project: { ...s.project, shots: { ...s.project.shots, [shotId]: { ...shot, mounts } } } }
    })
    if (willChange) touchPrompt(shotId)
  },

  removeMount: (shotId, assetId) => {
    if (!can(get().project, 'editMounts')) return
    const shot0 = get().project.shots[shotId]
    const willChange = !!shot0 && shot0.mounts.some((m) => m.assetId === assetId)
    set((s) => {
      const shot = s.project.shots[shotId]
      if (!shot) return s
      const mounts = shot.mounts.filter((m) => m.assetId !== assetId)
      return { project: { ...s.project, shots: { ...s.project.shots, [shotId]: { ...shot, mounts } } } }
    })
    if (willChange) touchPrompt(shotId)
  },

  updateSceneTrack: (sceneId, patch) => {
    if (!can(get().project, 'editSceneTrack')) return
    set((s) => {
      const scene = s.project.scenes[sceneId]
      if (!scene) return s
      return {
        project: {
          ...s.project,
          scenes: { ...s.project.scenes, [sceneId]: { ...scene, track: { ...scene.track, ...patch } } },
        },
      }
    })
  },

  // 改提示词 → promptRevision + 1（决策 4.2）。进入视觉筹备后仍可改（editPrompt 恒为 true）。
  updateAssetPrompt: (assetId, text) => {
    if (!can(get().project, 'editPrompt')) return
    const before = get().project.assets[assetId]
    if (!before || before.imagePrompt === text) return
    set((s) => {
      const a = s.project.assets[assetId]
      if (!a || a.imagePrompt === text) return s
      return {
        project: {
          ...s.project,
          assets: {
            ...s.project.assets,
            [assetId]: { ...a, imagePrompt: text, promptRevision: a.promptRevision + 1 },
          },
        },
      }
    })
    // v2.0：资产提示词变了 → 引用它的镜头画面提示词过期，标待更新（只标不重生，v3 铁律 3）。
    for (const sid of shotsAffectedByAsset(get().project, assetId)) touchPrompt(sid, false)
  },


  setHoverMention: (m) => {
    const cur = get().hoverMention
    if (cur === m) return
    if (cur && m && cur.assetId === m.assetId && cur.shotId === m.shotId) return
    set({ hoverMention: m })
  },

  setHoverAssetTerm: (t) => {
    const cur = get().hoverAssetTerm
    if (cur === t) return
    if (!cur && !t) return
    set({ hoverAssetTerm: t })
  },



  // 改某着装角色引用的服装集合（v2.0，editLookBinding 放开后）。
  setLookCostumes: (lookId, costumeIds) => {
    if (!can(get().project, 'editLookBinding')) return
    const look = get().project.assets[lookId]
    if (!look || look.kind !== 'look') return
    set((s) => {
      const l = s.project.assets[lookId]
      if (!l || l.kind !== 'look') return s
      return {
        project: {
          ...s.project,
          assets: { ...s.project.assets, [lookId]: { ...l, costumeIds: [...costumeIds] } },
        },
      }
    })
    // 换服装是视觉变更：引用该造型的镜头画面提示词过期 → 标待更新（只标不重生）。
    for (const sid of shotsAffectedByAsset(get().project, lookId)) touchPrompt(sid, false)
  },

  // 为角色新建一个着装角色。返回新 look id；不满足能力位或角色不存在时返回空串。
  createLook: (characterId, costumeIds) => {
    if (!can(get().project, 'editLookBinding')) return ''
    const ch = get().project.assets[characterId]
    if (!ch || ch.kind !== 'character') return ''
    const id = `lk_ins${++insSeq}`
    const look: Look = {
      id, kind: 'look', name: '', characterId, costumeIds: [...costumeIds],
      imagePrompt: '', promptRevision: 0,
    }
    // 名称用派生名占位存下来，便于后续原文高亮与展示（与 seed 的显式命名一致）。
    look.name = lookName(look, get().project.assets)
    set((s) => ({
      project: { ...s.project, assets: { ...s.project.assets, [id]: look } },
    }))
    return id
  },




  deleteEpisode: (episodeId) => {
    if (!can(get().project, 'editScript')) return
    const s = get()
    const proj = s.project
    if (proj.episodes.length <= 1) {
      get().showToast('项目中至少需要保留 1 集，暂时无法删除')
      return
    }
    const ep = proj.episodes.find((e) => e.id === episodeId)
    if (!ep) return
    const shotCount = ep.sceneIds.reduce((n, sid) => n + (proj.scenes[sid]?.shotIds.length ?? 0), 0)
    // v2.0：删集不动资产库。删除前后各统计一次未引用数，差值 = 本次新增的未引用项 K。
    const unrefBefore = countUnreferenced(usageIndexOf(proj))
    const next = deleteEpisodeSvc(proj, episodeId)
    const renum = { ...next, episodes: next.episodes.map((e, i) => ({ ...e, no: i + 1 })) }
    const firstScene = renum.episodes[0]?.sceneIds[0] ?? ''
    const k = Math.max(0, countUnreferenced(usageIndexOf(renum)) - unrefBefore)
    set({
      project: renum,
      selectedSceneId: firstScene,
      sceneSettingsOpen: false,
      activeTab: 'shot',
    })
    get().showToast(
      `第 ${ep.no} 集已删除（${shotCount} 个镜头）。项目资产库一条未减，其中 ${k} 项变为「当前剧本未引用」。`,
    )
  },



  setStage: (stage) => {
    set((s) => {
      // 进入视觉筹备：把第一批资产的 deliveredRevision 对齐到 promptRevision（决策 6.7）。
      const project = stage === 'visual' ? deliverFirstBatch({ ...s.project, stage }) : { ...s.project, stage }
      return { project, activePage: stage }
    })
    if (stage === 'visual') get().showToast('已进入项目资产库，第一批资产开始生成。剧本和提示词仍可调整，角色与服装组合保持不变。')
  },



  renameCandidate: (tempId, name) => {
    const trimmed = name.trim()
    if (!trimmed) return
    set((st) => ({
      candidates: st.candidates.map((c) => (c.tempId === tempId ? { ...c, name: trimmed } : c)),
    }))
  },

  addManualCandidate: (kind, name) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const tempId = `cand_manual_${kind}_${++insSeq}`
    set((st) => ({
      candidates: [...st.candidates, { tempId, kind, name: trimmed, imagePrompt: '', decision: 'new' }],
    }))
  },

  removeCandidate: (tempId) =>
    set((st) => ({ candidates: st.candidates.filter((c) => c.tempId !== tempId) })),

  setCandidatePrompt: (tempId, text) =>
    set((st) => ({
      candidates: st.candidates.map((c) => (c.tempId === tempId ? { ...c, imagePrompt: text } : c)),
    })),

  completeCandidatePrompt: (tempId) => {
    const s = get()
    const cand = s.candidates.find((c) => c.tempId === tempId)
    if (!cand || cand.imagePrompt.trim()) return
    // 演示用：结合剧名与类目合成一版可读草案（真实系统会调模型读原文，这里纯前端占位）。
    const KIND_NOUN: Record<AssetKind, string> = {
      character: '角色素模设定板', costume: '服装平铺图', location: '场景空镜',
      prop: '道具产品图', look: '着装定妆图',
    }
    const draft = `【AI 补全草案】结合《${s.project.title}》原文，为「${cand.name}」生成的${KIND_NOUN[cand.kind]}提示词：纯白/中性背景，写实电影质感，突出「${cand.name}」的关键特征，无水印、无文字标注。可入库后继续细化。`
    set((st) => ({
      candidates: st.candidates.map((c) => (c.tempId === tempId ? { ...c, imagePrompt: draft } : c)),
    }))
    get().showToast(`已为「${cand.name}」补全一版提示词草案，可点开继续修改。`)
  },


  attachCandidateCostume: (charTempId, costumeId) =>
    set((st) => ({
      candidates: st.candidates.map((c) => {
        if (c.tempId !== charTempId) return c
        if ((c.costumeIds ?? []).includes(costumeId)) return c
        return { ...c, costumeIds: [...(c.costumeIds ?? []), costumeId] }
      }),
    })),

  detachCandidateCostume: (charTempId, costumeId) =>
    set((st) => ({
      candidates: st.candidates.map((c) => {
        if (c.tempId !== charTempId) return c
        const lookPrompts = { ...(c.lookPrompts ?? {}) }
        delete lookPrompts[costumeId]
        return { ...c, costumeIds: (c.costumeIds ?? []).filter((id) => id !== costumeId), lookPrompts }
      }),
    })),


  setCandidateLookPrompt: (charTempId, costumeId, text) =>
    set((st) => ({
      candidates: st.candidates.map((c) =>
        c.tempId === charTempId
          ? { ...c, lookPrompts: { ...(c.lookPrompts ?? {}), [costumeId]: text } }
          : c,
      ),
    })),

  completeCandidateLookPrompt: (charTempId, costumeId) => {
    const s = get()
    const cand = s.candidates.find((c) => c.tempId === charTempId)
    if (!cand) return
    const costumeName =
      s.candidates.find((c) => c.tempId === costumeId)?.name ??
      s.project.assets[costumeId]?.name ??
      '服装'
    // 融合式草案：素模 + 服装。真实系统会读原文，这里纯前端占位（演示）。
    const draft = `${cand.name}素模 + ${costumeName}的融合造型：把角色素模与该服装融合成一张穿好衣服的定妆图，人物一致性以角色素模为准、服装款式与颜色以服装资产为准。背景中性、写实电影质感、无水印无文字。`
    set((st) => ({
      candidates: st.candidates.map((c) =>
        c.tempId === charTempId
          ? { ...c, lookPrompts: { ...(c.lookPrompts ?? {}), [costumeId]: draft } }
          : c,
      ),
    }))
  },





  // ── 统一任务弹窗（v2.2 §4）──
  previewCandidates: (scanned) => extractCandidates(get().project, scanned),

  commitScanned: (cands) => {
    const s = get()
    const { project } = commitCandidatesSvc(s.project, cands)
    set({ project })
  },

  scannedForEp2: () => EP2_SCANNED,

  runResplitScene: (sceneId, opts) => {
    if (!can(get().project, 'editScript')) return
    applyResplitScene(sceneId, opts)
  },
  runResplitEpisode: (episodeId, opts) => {
    if (!can(get().project, 'editScript')) return
    applyResplitEpisode(episodeId, opts)
  },



  commitLibrary: () => {
    const s = get()
    if (s.project.libraryCommittedAt != null) return
    const { project } = commitCandidatesSvc(s.project, s.candidates)
    set({
      project: { ...project, libraryCommittedAt: Date.now() },
      candidates: [],
    })
    // 不发 Toast（§3.5）：「已保存 → 请开始拆分」是没有新决策的停顿，只在教用户"还有第二步"。
    // 入库与拆分在同一个统一弹窗里一次确认完成，结果 Toast 由拆分那一步统一给。
  },

  startSplit: (opts) => {
    const s = get()
    // 颗粒度真的生效（§5.1）：有密度预设的场（本演示是第 1 场）按选定颗粒度取整套镜，
    // 其余场没有多套方案，回落 seed 的标准模板。默认取 project.defaultDensity。
    const density = opts.density ?? s.project.defaultDensity
    // 生成分镜：把挂载重指到已入库资产（committed id = `as_${tempId}`，
    // 着装角色 = `lk_as_${characterTempId}`），因为 seedCandidates 的 tempId 取自 seed 资产 id。
    const remapId = (seedId: string): string => {
      const a = seedProject.assets[seedId]
      if (a?.kind === 'look') return `lk_as_${a.characterId}`
      return `as_${seedId}`
    }
    // 场在这一刻才被**创建**——步骤①② 只有集，没有场。
    // 对每个「已提取资产、还没有场」的集，从 seed 里取属于它的场整套建出来并回写 sceneIds；
    // 已经有场的集跳过（那是重拆的活，走别的路）。
    const scenes = { ...s.project.scenes }
    const shots: Record<string, Shot> = { ...s.project.shots }
    let created = 0
    const episodes = s.project.episodes.map((ep) => {
      if (!ep.extractedAt || ep.sceneIds.length > 0) return ep
      // 手动新建的集：seed 里没有它，建一个空场收着正文，镜头留给用户手动插。
      if (isManualEpisode(ep.id)) {
        const sc = manualScene(ep, density)
        scenes[sc.id] = sc
        return { ...ep, sceneIds: [sc.id] }
      }
      const sceneIds: string[] = []
      for (const [sid, tmpl] of Object.entries(seedProject.scenes)) {
        if (tmpl.episodeId !== ep.id) continue
        const usePreset = hasDensityPresets(sid)
        const src = usePreset
          ? densityShots(sid, density)
          : tmpl.shotIds.map((id) => seedProject.shots[id]).filter((sh): sh is Shot => !!sh)
        scenes[sid] = {
          ...structuredClone(tmpl),
          shotIds: src.map((sh) => sh.id),
          density: usePreset ? density : 'standard',
        }
        for (const sh of src) {
          shots[sh.id] = {
            ...structuredClone(sh),
            mounts: sh.mounts.map((m) => ({ kind: m.kind, assetId: remapId(m.assetId) })),
          }
          created++
        }
        sceneIds.push(sid)
      }
      return { ...ep, sceneIds }
    })
    const project: Project = { ...s.project, episodes, scenes, shots }
    set({
      project,
      analysisStep: 'storyboard',
      activeTab: 'shot',
      // 拆完落全剧视图（v2.7 §5.2）：第一眼该看到整部剧被拆成了什么样。
      viewScope: { kind: 'project' },
      selectedSceneId: project.episodes.find((e) => e.sceneIds.length > 0)?.sceneIds[0] ?? '',
      sceneSettingsOpen: false,
    })
    get().showToast(`已按剧本拆分为 ${created} 个镜头，可开始逐镜生成画面与视频提示词。`)
  },

  // ── 资产库侧（v3 唯一的删除出口）──
  deleteAsset: (assetId) => {
    const s = get()
    if (!s.project.assets[assetId]) return
    // 先算受影响镜头（基于删除前的挂载），删除后置为 stale。
    const affected = shotsAffectedByAsset(s.project, assetId)
    set((st) => {
      const assets = { ...st.project.assets }
      delete assets[assetId]
      // ⚠ 不清理 mounts —— 资产库不回写分镜（单向）。挂载指向失效 id，由 UI 兜底渲染「已失效」。
      const promptStates = { ...st.promptStates }
      for (const sid of affected) if (promptStates[sid] === 'ready') promptStates[sid] = 'stale'
      return { project: { ...st.project, assets }, promptStates }
    })
    get().showToast(
      affected.length
        ? `已从项目资产库删除该资产。引用它的 ${affected.length} 个镜头挂载已失效并标记待更新。`
        : '已从项目资产库删除该资产。',
    )
  },
  }
})
