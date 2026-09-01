// Zustand：一个 project + 所有动作。不做持久化，刷新回到初始状态。
import { create } from 'zustand'
import type { Look, MountRef, Project, PromptState, Scene, Shot, ShotDensity, Stage } from '../data/types'
import { seedProject } from '../data/seed'
import { episode2Payload } from '../data/seedEpisode2'
import { appendEpisode } from '../services/incremental'
import { replaceScript as replaceScriptSvc, type ScriptPayload } from '../services/replace'
import { densityShots, hasDensityPresets, resplitSceneDensity } from '../services/density'
import { deleteEpisode as deleteEpisodeSvc, resplitScene } from '../services/lock'
import { can } from '../services/capability'
import { buildUsageIndex, type AssetUsage } from '../services/appearanceIndex'
import { unreferencedCount as countUnreferenced } from '../services/reference'
import { deliverFirstBatch, shotsAffectedByAsset } from '../services/staleness'
import { lookName } from '../services/looks'
import { sceneDuration } from '../services/timeline'
import { findDuplicate, PROSE_FIELDS, scanRenameImpact } from '../services/mentions'

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

/** 演示相位机：进站空态 → 模拟上传 → 解析中（内容分区错峰显现）→ 完成。
 *  纯 UI 态，不进领域模型。seed 始终完整加载，动画只做呈现层揭示。 */
export type AnalysisPhase = 'empty' | 'uploading' | 'analyzing' | 'done'

export interface ToastAction {
  label: string
  run: () => void
}

export interface Toast {
  id: number
  text: string
  action?: ToastAction
}

const DENSITY_LABEL: Record<ShotDensity, string> = {
  compact: '紧凑',
  standard: '标准',
  loose: '舒缓',
}

interface UIState {
  activePage: Stage
  selectedSceneId: string
  activeTab: Tab
  scriptOpen: boolean
  sceneSettingsOpen: boolean
  navCollapsed: boolean
  toast: Toast | null
  // ── 拆解过程演示 ──
  analysisPhase: AnalysisPhase
  // 解析中已揭示到第几阶段（0=读取，1=集场，2=剧本，3=分镜，4=资产）。控制器递增。
  revealStage: number
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
}

// 面板宽度夹取范围。
export const PANEL_MIN = { episode: 150, script: 200 }
export const PANEL_MAX = { episode: 380, script: 620 }

interface StoreState extends UIState {
  project: Project

  // 提示词生成状态：shotId → PromptState。第一眼全部 pending，需点「生成全部提示词」。
  promptStates: Record<string, PromptState>

  /** 镜头提示词是否被手动编辑过。与 promptStates 是两个正交维度：
   *  一个镜头可以同时是「已手动编辑」和「待更新」。UI 态，不进 Shot 数据模型。 */
  promptEdited: Record<string, boolean>

  // ── 派生便捷读取 ──
  currentScene: () => Project['scenes'][string] | undefined
  usageIndex: () => Record<string, AssetUsage>
  countShotsOf: (assetId: string) => number

  // ── UI 动作 ──
  toggleNav: () => void
  setPage: (page: Stage) => void
  selectScene: (sceneId: string) => void
  setTab: (tab: Tab) => void
  // 从资产「出场明细」点某集某场：跳到该场的分镜表，并高亮该资产出现的镜头。
  jumpToAppearance: (assetId: string, episodeNo: number, sceneNo: number) => void
  toggleScript: () => void
  setScriptOpen: (open: boolean) => void
  openSceneSettings: () => void
  closeSceneSettings: () => void
  showToast: (text: string, action?: ToastAction) => void
  dismissToast: () => void

  // ── 拆解过程演示动作 ──
  // 空态点「导入剧本」：进 uploading（模拟上传），控制器随后转 analyzing。
  startUpload: () => void
  setAnalysisPhase: (phase: AnalysisPhase) => void
  setRevealStage: (stage: number) => void
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
  renameAsset: (assetId: string, name: string) => void
  /**
   * 改名 + 全链路同步。资产表就地改完名字、回车/失焦后弹「确认」，用户勾完再调这里。
   *
   * 两件事性质完全不同，所以分开做：
   *   · 引用侧（挂载 / 造型名 / 出场统计）—— 只改 assets[id].name 一个字段就自动跟随，不问用户；
   *   · 文本侧（散文字段 / 提示词）—— 按字面替换，由 opts 决定替不替。
   *
   * 关键口径：**改名不是视觉变更**。勾了替换的镜头保持 ready，已出的图不作废；
   * 只有「不替换」才真的不一致（提示词里的旧名指不到任何资产），那些镜头才标待更新。
   */
  renameAssetWithSync: (
    assetId: string,
    name: string,
    opts: { prose: boolean; prompts: boolean },
  ) => void
  setHoverMention: (m: { assetId: string; shotId: string } | null) => void
  toggleAssetExcluded: (assetId: string) => void
  // ── 造型手动挂载（v2.0，受 editLookBinding 约束）──
  /** 改某着装角色引用的服装集合。挂载的镜头视觉随之变化 → 标待更新。 */
  setLookCostumes: (lookId: string, costumeIds: string[]) => void
  /** 为角色新建一个着装角色（look）。返回新 look 的 id，失败返回空串。 */
  createLook: (characterId: string, costumeIds: string[]) => string
  appendEpisode2: () => void
  replaceScript: (payload: ScriptPayload) => void
  replaceEpisode: (episodeId: string) => void
  deleteEpisode: (episodeId: string) => void
  resplit: (sceneId: string, opts: { density?: ShotDensity; targetShots?: number }) => void
  resplitEpisode: (episodeId: string, opts: { density: ShotDensity; sceneCount?: number }) => void
  setStage: (stage: Stage) => void
}

let toastSeq = 0
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

/** 初始把某 project 下所有镜头置为 pending（第一眼没生成提示词）。 */
function initPromptStates(project: Project): Record<string, PromptState> {
  const m: Record<string, PromptState> = {}
  for (const id of Object.keys(project.shots)) m[id] = 'pending'
  return m
}

/** 初始的手动编辑标记：空对象（没人编辑过）。 */
function initPromptEdited(_project: Project): Record<string, boolean> {
  return {}
}

/** 结构性改动后，把两张提示词映射对齐到新 project 的镜头集合：
 *  幸存镜头沿用旧状态 / 编辑标记，新镜头回落 pending，被删镜头的孤儿键一并清掉。 */
function reconcilePrompts(
  project: Project,
  states: Record<string, PromptState>,
  edited: Record<string, boolean>,
): { promptStates: Record<string, PromptState>; promptEdited: Record<string, boolean> } {
  const promptStates: Record<string, PromptState> = {}
  const promptEdited: Record<string, boolean> = {}
  for (const id of Object.keys(project.shots)) {
    promptStates[id] = states[id] ?? 'pending'
    if (edited[id]) promptEdited[id] = true
  }
  return { promptStates, promptEdited }
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

  return {
  project: structuredClone(seedProject),
  promptStates: initPromptStates(seedProject),
  promptEdited: initPromptEdited(seedProject),
  activePage: 'analysis',
  selectedSceneId: 's1',
  activeTab: 'shot',
  scriptOpen: false,
  sceneSettingsOpen: false,
  navCollapsed: false,
  toast: null,
  // 进站默认空态：先看到空剧本页，点「导入剧本」才开始拆解演示。
  analysisPhase: 'empty',
  revealStage: 0,
  episodeW: 192,
  scriptW: 308,
  flashShotIds: [],
  hoverMention: null,

  currentScene: () => get().project.scenes[get().selectedSceneId],
  usageIndex: () => usageIndexOf(get().project),
  // 镜数读派生索引（含 look 向角色 / 服装的向上聚合），不再每次遍历 shots。
  countShotsOf: (assetId) => usageIndexOf(get().project)[assetId]?.shotCount ?? 0,

  toggleNav: () => set((s) => ({ navCollapsed: !s.navCollapsed })),
  setPage: (activePage) => set({ activePage }),
  // 切场时关掉场级设定抽屉（抽屉里的内容属于上一场）。
  selectScene: (sceneId) => set({ selectedSceneId: sceneId, sceneSettingsOpen: false }),
  setTab: (activeTab) => set({ activeTab }),
  jumpToAppearance: (assetId, episodeNo, sceneNo) => {
    const proj = get().project
    const ep = proj.episodes.find((e) => e.no === episodeNo)
    if (!ep) return
    const sceneId = ep.sceneIds.find((id) => proj.scenes[id]?.no === sceneNo)
    if (!sceneId) return
    const scene = proj.scenes[sceneId]
    if (!scene) return
    // 本场里「涉及该资产」的镜头：直接挂载，或经着装角色(look)向上聚合到角色/服装（与出场索引同口径）。
    const involves = (shot: Shot) =>
      shot.mounts.some((m) => {
        if (m.assetId === assetId) return true
        const a = proj.assets[m.assetId]
        if (a && a.kind === 'look') {
          const lk = a as Look
          return lk.characterId === assetId || lk.costumeIds.includes(assetId)
        }
        return false
      })
    const ids = scene.shotIds.filter((id) => {
      const sh = proj.shots[id]
      return sh && involves(sh)
    })
    set({ selectedSceneId: sceneId, activeTab: 'shot', sceneSettingsOpen: false, flashShotIds: ids })
    // 高亮几秒后自动消退；若期间又发起新的跳转（ids 引用变了）则不误清。
    setTimeout(() => {
      if (get().flashShotIds === ids) set({ flashShotIds: [] })
    }, 2600)
  },
  toggleScript: () => set((s) => ({ scriptOpen: !s.scriptOpen })),
  setScriptOpen: (scriptOpen) => set({ scriptOpen }),
  openSceneSettings: () => set({ sceneSettingsOpen: true }),
  closeSceneSettings: () => set({ sceneSettingsOpen: false }),
  showToast: (text, action) => {
    const id = ++toastSeq
    set({ toast: { id, text, action } })
  },
  dismissToast: () => set({ toast: null }),

  // 空态点「导入剧本」→ 模拟上传态。真正的时间线推进由 App 里的揭示控制器接管。
  startUpload: () => set({ analysisPhase: 'uploading', revealStage: 0 }),
  setAnalysisPhase: (analysisPhase) => set({ analysisPhase }),
  setRevealStage: (revealStage) => set({ revealStage }),
  setPanelW: (which, width) => {
    const w = Math.round(Math.min(PANEL_MAX[which], Math.max(PANEL_MIN[which], width)))
    set(which === 'episode' ? { episodeW: w } : { scriptW: w })
  },
  replayDemo: () =>
    set({
      analysisPhase: 'empty',
      revealStage: 0,
      selectedSceneId: 's1',
      activeTab: 'shot',
      scriptOpen: false,
      sceneSettingsOpen: false,
      toast: null,
    }),

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
    targets.forEach((id, i) => {
      setTimeout(() => {
        set((s) => ({ promptStates: { ...s.promptStates, [id]: 'ready' } }))
        if (i === targets.length - 1) {
          get().showToast(`已生成 ${targets.length} 镜的画面提示词与视频运动提示词`)
        }
      }, 420 + i * 220)
    })
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
  },

  // 改资产名 / 别名。名称真相源在进入资产库后移交下游，故 editAssetName 仅 analysis 阶段可用。
  renameAsset: (assetId, name) => {
    if (!can(get().project, 'editAssetName')) return
    const trimmed = name.trim()
    if (!trimmed) return
    set((s) => {
      const a = s.project.assets[assetId]
      if (!a || a.name === trimmed) return s
      return {
        project: { ...s.project, assets: { ...s.project.assets, [assetId]: { ...a, name: trimmed } } },
      }
    })
  },

  setHoverMention: (m) => {
    const cur = get().hoverMention
    if (cur === m) return
    if (cur && m && cur.assetId === m.assetId && cur.shotId === m.shotId) return
    set({ hoverMention: m })
  },

  // 改名 + 全链路同步。声明见接口处的长注释。
  renameAssetWithSync: (assetId, name, opts) => {
    const st0 = get()
    if (!can(st0.project, 'editAssetName')) return
    const asset = st0.project.assets[assetId]
    if (!asset) return
    const next = name.trim()
    const old = asset.name
    if (!next || next === old) return
    // 重名一律拦在这里（本版不做「合并为同一角色」）。
    if (findDuplicate(st0.project.assets, assetId, next)) {
      get().showToast(`已存在同名内容「${next}」，名称不能重复`)
      return
    }

    // 撤销快照：名字与所有文本替换一起回滚。改名影响面大，撤销比多给几个复选框有用。
    const snapProject = st0.project
    const snapStates = st0.promptStates
    const impact = scanRenameImpact(st0.project, st0.promptStates, assetId, next)

    set((s) => {
      // ① 引用侧：一个字段。
      const assets = { ...s.project.assets, [assetId]: { ...s.project.assets[assetId]!, name: next } }

      // 角色造型名跟随。lookName() 只在 Look.name 为空时才从「角色 · 服装」派生，
      // AI 拆解通常会给一个显式名（「苏可 · 宽松连帽卫衣」），那是一份**存下来的字符串**，
      // 不会自己跟着角色名变 —— 所以这里要把它里面的旧名换掉。
      // 放在引用侧（不受勾选项控制）：弹窗的「自动更新」承诺了造型名会跟随，就得真的跟随。
      for (const id of Object.keys(assets)) {
        const l = assets[id]!
        if (l.kind !== 'look') continue
        const related = l.characterId === assetId || l.costumeIds.includes(assetId)
        if (!related || !l.name?.includes(old)) continue
        assets[id] = { ...l, name: l.name.split(old).join(next) }
      }

      // ② 文本侧。
      const shots = { ...s.project.shots }
      const promptStates = { ...s.promptStates }
      for (const id of Object.keys(shots)) {
        const shot = shots[id]!
        const patch: Record<string, string> = {}

        if (opts.prose) {
          for (const { field } of PROSE_FIELDS) {
            const text = String(shot[field] ?? '')
            if (!text.includes(old)) continue
            patch[field as string] = text.split(old).join(next)
          }
        }

        if (opts.prompts) {
          // 提示词文本对所有镜头都替换（含 pending）—— 否则 pending 镜头一旦生成，
          // 又会把旧名字带回来。计数只给用户看得见的那些，见 scanRenameImpact。
          if (shot.imagePrompt?.includes(old)) {
            patch.imagePrompt = shot.imagePrompt.split(old).join(next)
          }
          if (shot.videoPrompt?.includes(old)) {
            patch.videoPrompt = shot.videoPrompt.split(old).join(next)
          }
        } else {
          // 不替换 = 提示词里的旧名指不到任何资产，这才是真的不一致 → 标待更新。
          const state = promptStates[id] ?? 'pending'
          const hit = shot.imagePrompt?.includes(old) || shot.videoPrompt?.includes(old)
          if (hit && state === 'ready') promptStates[id] = 'stale'
        }

        if (Object.keys(patch).length) shots[id] = { ...shot, ...patch }
      }

      // ③ 资产自己的生图提示词。
      // 注意**不动 promptRevision** —— 名字是标签不是视觉属性，不该让下游已出的图变「已过期」。
      if (opts.prompts) {
        for (const id of Object.keys(assets)) {
          const a = assets[id]!
          if (!a.imagePrompt?.includes(old)) continue
          assets[id] = { ...a, imagePrompt: a.imagePrompt.split(old).join(next) }
        }
      }

      return { project: { ...s.project, assets, shots }, promptStates }
    })

    const bits = [`已重命名「${old}」→「${next}」`]
    if (opts.prose && impact.prose.length) bits.push(`正文替换 ${impact.prose.length} 处`)
    if (opts.prompts && impact.shotPrompts.length) bits.push(`提示词替换 ${impact.shotPrompts.length} 镜`)
    get().showToast(bits.join('，'), {
      label: '撤销',
      run: () => set({ project: snapProject, promptStates: snapStates }),
    })
  },

  // 切换「不出图」。出图队列一旦开跑，排除与否由资产库处理，故 toggleExcluded 仅 analysis 阶段可用。
  toggleAssetExcluded: (assetId) => {
    if (!can(get().project, 'toggleExcluded')) return
    set((s) => {
      const a = s.project.assets[assetId]
      if (!a) return s
      return {
        project: { ...s.project, assets: { ...s.project.assets, [assetId]: { ...a, excluded: !a.excluded } } },
      }
    })
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

  appendEpisode2: () => {
    if (!can(get().project, 'editScript')) return
    const s = get()
    if (s.project.episodes.some((e) => e.id === 'e2')) {
      get().showToast('第 2 集已在项目中，无需重复添加。')
      return
    }
    const next = appendEpisode(s.project, episode2Payload)
    set({ project: next, ...reconcilePrompts(next, s.promptStates, s.promptEdited) })
    get().showToast('第 2 集已添加。已有角色资料已自动沿用，新角色资料也已创建。')
  },

  replaceScript: (payload) => {
    if (!can(get().project, 'editScript')) return
    // v2.0：整本替换仅首次入库前可用。已入库后换剧本请新建项目（引导，不静默丢弃）。
    if (!can(get().project, 'replaceWholeScript')) {
      get().showToast('已保存到项目资产库，换一部剧本请新建项目')
      return
    }
    const s = get()
    const next = replaceScriptSvc(s.project, payload)
    const firstScene = next.episodes[0]?.sceneIds[0] ?? ''
    // 整本替换：全部镜头都是新 id，reconcile 后自然全回 pending、手动痕迹清空。
    set({
      project: next,
      ...reconcilePrompts(next, s.promptStates, s.promptEdited),
      selectedSceneId: firstScene,
      sceneSettingsOpen: false,
      activeTab: 'shot',
    })
    get().showToast(`已导入《${payload.title}》，原剧本内容已替换。`)
  },

  // 替换本集：语义诚实地实现为「删除本集 + 追加新集」。演示只有一套「新集」内容（第 2 集），
  // 若它已存在则不替换，如实告知，避免删了却补不上。
  replaceEpisode: (episodeId) => {
    if (!can(get().project, 'editScript')) return
    const s = get()
    const proj = s.project
    const ep = proj.episodes.find((e) => e.id === episodeId)
    if (!ep) return
    const remaining = proj.episodes.filter((e) => e.id !== episodeId)
    if (remaining.some((e) => e.id === 'e2')) {
      get().showToast('当前演示仅支持一套新剧本内容，且第 2 集已存在，无法替换本集')
      return
    }
    const deleted = deleteEpisodeSvc(proj, episodeId)
    const appended = appendEpisode(deleted, episode2Payload)
    // 集号顺序整理，避免删中间集后号码跳空。
    const renum = { ...appended, episodes: appended.episodes.map((e, i) => ({ ...e, no: i + 1 })) }
    const newEp = renum.episodes.find((e) => e.id === 'e2')
    const firstScene = newEp?.sceneIds[0] ?? renum.episodes[0]?.sceneIds[0] ?? ''
    // 新集镜头都是新 id → reconcile 后全回 pending、手动痕迹清空；其他集状态照旧。
    set({
      project: renum,
      ...reconcilePrompts(renum, s.promptStates, s.promptEdited),
      selectedSceneId: firstScene,
      sceneSettingsOpen: false,
      activeTab: 'shot',
    })
    get().showToast(`第 ${ep.no} 集已替换，其他剧集没有改变。`)
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
      ...reconcilePrompts(renum, s.promptStates, s.promptEdited),
      selectedSceneId: firstScene,
      sceneSettingsOpen: false,
      activeTab: 'shot',
    })
    get().showToast(
      `第 ${ep.no} 集已删除（${shotCount} 个镜头）。项目资产库一条未减，其中 ${k} 项变为「当前剧本未引用」。`,
    )
  },

  resplit: (sceneId, opts) => {
    if (!can(get().project, 'editScript')) return
    const s = get()
    const scene = s.project.scenes[sceneId]
    if (!scene) return

    // 该场没有多套预设 → 回退到「恢复初始」。
    if (!hasDensityPresets(sceneId)) {
      const reset = resplitScene(s.project, sceneId)
      const rscene = reset.scenes[sceneId]!
      const next = { ...reset, scenes: { ...reset.scenes, [sceneId]: { ...rscene, density: 'standard' as ShotDensity } } }
      set({ project: next, ...reconcilePrompts(next, s.promptStates, s.promptEdited), sceneSettingsOpen: false })
      get().showToast('当前演示仅第 1 场支持不同镜头节奏，本场已按原方式重新生成')
      return
    }

    // 指定镜数 → 选最接近的一套，如实说明。
    if (opts.targetShots != null && opts.density == null) {
      const density = closestDensity(sceneId, opts.targetShots)
      const next = resplitSceneDensity(s.project, sceneId, density)
      set({ project: next, ...reconcilePrompts(next, s.promptStates, s.promptEdited), sceneSettingsOpen: false })
      get().showToast(
        `已按「期望 ${opts.targetShots} 个镜头」重新拆分：当前演示中最接近的方案为「${DENSITY_LABEL[density]}」，共 ${densityShots(sceneId, density).length} 个镜头`,
      )
      return
    }

    // 指定颗粒度（或照原颗粒度重拆一次）。
    const density = opts.density ?? scene.density
    const next = resplitSceneDensity(s.project, sceneId, density)
    set({ project: next, ...reconcilePrompts(next, s.promptStates, s.promptEdited), sceneSettingsOpen: false })
    get().showToast(`「${scene.name}」已按${DENSITY_LABEL[density]}节奏重新拆分为 ${densityShots(sceneId, density).length} 个镜头，其他场景没有改变。`)
  },

  resplitEpisode: (episodeId, opts) => {
    if (!can(get().project, 'editScript')) return
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
      ...reconcilePrompts(proj, s.promptStates, s.promptEdited),
      selectedSceneId: ep.sceneIds[0] ?? s.selectedSceneId,
      sceneSettingsOpen: false,
    })

    let msg = applied.length
      ? `已重新拆分第 ${ep.no} 集：${applied.join('，')}`
      : `已重新拆分第 ${ep.no} 集`
    if (kept.length) msg += `，第 ${kept.join(' / ')} 场当前演示无多套方案，保持原方式`
    if (opts.sceneCount != null) msg += '；当前版本暂不支持调整场景数量'
    get().showToast(msg)
  },

  setStage: (stage) => {
    set((s) => {
      // 进入视觉筹备：把第一批资产的 deliveredRevision 对齐到 promptRevision（决策 6.7）。
      const project = stage === 'visual' ? deliverFirstBatch({ ...s.project, stage }) : { ...s.project, stage }
      return { project, activePage: stage }
    })
    if (stage === 'visual') get().showToast('已进入项目资产库，第一批资产开始生成。剧本和提示词仍可调整，角色与服装组合保持不变。')
  },
  }
})
