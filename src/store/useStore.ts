// Zustand：一个 project + 所有动作。不做持久化，刷新回到初始状态。
import { create } from 'zustand'
import type { Asset, MountRef, Project, PromptState, Scene, Shot, ShotDensity, Stage } from '../data/types'
import { seedProject } from '../data/seed'
import { episode2Payload } from '../data/seedEpisode2'
import { appendEpisode } from '../services/incremental'
import { replaceScript as replaceScriptSvc, type ScriptPayload } from '../services/replace'
import { densityShots, hasDensityPresets, resplitSceneDensity } from '../services/density'
import { deleteEpisode as deleteEpisodeSvc, resplitScene } from '../services/lock'
import { can } from '../services/capability'
import { buildUsageIndex, type AssetUsage } from '../services/appearanceIndex'
import { deliverFirstBatch } from '../services/staleness'
import { sceneDuration } from '../services/timeline'

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
}

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
  toggleScript: () => void
  openSceneSettings: () => void
  closeSceneSettings: () => void
  showToast: (text: string, action?: ToastAction) => void
  dismissToast: () => void

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
  // 删除一个场（级联删镜 + 清理只在本场出现的孤儿资产 + 顺延重编号），并弹出可撤销的 toast。
  deleteScene: (sceneId: string) => void
  // 删除一个镜头（顺延重编号），并弹出可撤销的 toast。
  deleteShot: (shotId: string) => void
  addMount: (shotId: string, mount: MountRef) => void
  removeMount: (shotId: string, assetId: string) => void
  updateSceneTrack: (sceneId: string, patch: Partial<Project['scenes'][string]['track']>) => void
  updateAssetPrompt: (assetId: string, text: string) => void
  renameAsset: (assetId: string, name: string) => void
  toggleAssetExcluded: (assetId: string) => void
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
      const no = get().project.shots[shotId]?.no
      get().showToast(`第 ${no} 镜内容已改动，记得重新生成提示词`)
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

  currentScene: () => get().project.scenes[get().selectedSceneId],
  usageIndex: () => usageIndexOf(get().project),
  // 镜数读派生索引（含 look 向角色 / 服装的向上聚合），不再每次遍历 shots。
  countShotsOf: (assetId) => usageIndexOf(get().project)[assetId]?.shotCount ?? 0,

  toggleNav: () => set((s) => ({ navCollapsed: !s.navCollapsed })),
  setPage: (activePage) => set({ activePage }),
  // 切场时关掉场级设定抽屉（抽屉里的内容属于上一场）。
  selectScene: (sceneId) => set({ selectedSceneId: sceneId, sceneSettingsOpen: false }),
  setTab: (activeTab) => set({ activeTab }),
  toggleScript: () => set((s) => ({ scriptOpen: !s.scriptOpen })),
  openSceneSettings: () => set({ sceneSettingsOpen: true }),
  closeSceneSettings: () => set({ sceneSettingsOpen: false }),
  showToast: (text, action) => {
    const id = ++toastSeq
    set({ toast: { id, text, action } })
  },
  dismissToast: () => set({ toast: null }),

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

    // 孤儿资产：仅在本场出现的资产（删除前用 usageIndex 判定），与集删除同一判据、收窄到单场。
    const idx = st0.usageIndex()
    const orphanIds = Object.values(st0.project.assets)
      .filter((a) => {
        const apps = idx[a.id]?.appearances ?? []
        return apps.length > 0 && apps.every((ap) => ap.episodeNo === ep.no && ap.sceneNo === scene.no)
      })
      .map((a) => a.id)

    // 快照（撤销原位还原用）
    const sceneSnap = structuredClone(scene)
    const shotSnaps = shotIds
      .map((id) => st0.project.shots[id])
      .filter(Boolean)
      .map((sh) => structuredClone(sh!)) as Shot[]
    const assetSnaps = orphanIds.map((id) => structuredClone(st0.project.assets[id]!)) as Asset[]
    const promptSnap: Record<string, PromptState> = {}
    const editedSnap: Record<string, boolean> = {}
    shotIds.forEach((id) => {
      promptSnap[id] = st0.promptStates[id] ?? 'pending'
      if (st0.promptEdited[id]) editedSnap[id] = true
    })

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
      const assets = { ...s.project.assets }
      orphanIds.forEach((id) => delete assets[id])
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
      return {
        project: { ...s.project, episodes, scenes, shots, assets },
        promptStates,
        promptEdited,
        selectedSceneId,
        sceneSettingsOpen: false,
      }
    })

    const restore = () => {
      set((s) => {
        if (s.project.scenes[sceneSnap.id]) return s
        const e = s.project.episodes.find((x) => x.id === epId)
        if (!e) return s
        const nextSceneIds = [...e.sceneIds]
        nextSceneIds.splice(Math.min(index, nextSceneIds.length), 0, sceneSnap.id)
        const episodes = s.project.episodes.map((x) => (x.id === epId ? { ...x, sceneIds: nextSceneIds } : x))
        const scenes = { ...s.project.scenes, [sceneSnap.id]: structuredClone(sceneSnap) }
        nextSceneIds.forEach((sid, i) => {
          const sc = scenes[sid]
          if (sc && sc.no !== i + 1) scenes[sid] = { ...sc, no: i + 1 }
        })
        const shots = { ...s.project.shots }
        shotSnaps.forEach((sh) => (shots[sh.id] = structuredClone(sh)))
        const assets = { ...s.project.assets }
        assetSnaps.forEach((a) => (assets[a.id] = structuredClone(a)))
        const promptStates = { ...s.promptStates }
        Object.entries(promptSnap).forEach(([id, ps]) => (promptStates[id] = ps))
        const promptEdited = { ...s.promptEdited }
        Object.keys(editedSnap).forEach((id) => (promptEdited[id] = true))
        return {
          project: { ...s.project, episodes, scenes, shots, assets },
          promptStates,
          promptEdited,
          selectedSceneId: sceneSnap.id,
        }
      })
    }

    get().showToast(`已删除第 ${oldNo} 场`, { label: '撤销', run: restore })
  },

  deleteShot: (shotId) => {
    if (!can(get().project, 'editShotFields')) return
    const st0 = get()
    const shot = st0.project.shots[shotId]
    if (!shot) return
    const scene0 = st0.project.scenes[shot.sceneId]
    if (!scene0) return
    const index = scene0.shotIds.indexOf(shotId)
    const oldNo = index + 1
    // 快照 + 原状态，供撤销时原位放回。
    const snapshot = structuredClone(shot)
    const prevPrompt = st0.promptStates[shotId] ?? 'pending'
    const prevEdited = !!st0.promptEdited[shotId]

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

    const restore = () => {
      set((s) => {
        const scene = s.project.scenes[snapshot.sceneId]
        if (!scene || s.project.shots[snapshot.id]) return s
        const shotIds = [...scene.shotIds]
        shotIds.splice(Math.min(index, shotIds.length), 0, snapshot.id)
        const shots = { ...s.project.shots, [snapshot.id]: structuredClone(snapshot) }
        shotIds.forEach((sid, i) => {
          const sh = shots[sid]
          if (sh && sh.no !== i + 1) shots[sid] = { ...sh, no: i + 1 }
        })
        return {
          project: { ...s.project, scenes: { ...s.project.scenes, [snapshot.sceneId]: { ...scene, shotIds } }, shots },
          promptStates: { ...s.promptStates, [snapshot.id]: prevPrompt },
          promptEdited: prevEdited
            ? { ...s.promptEdited, [snapshot.id]: true }
            : s.promptEdited,
        }
      })
    }

    get().showToast(`已删除第 ${oldNo} 镜`, { label: '撤销', run: restore })
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
    const before = Object.keys(proj.assets).length
    const next = deleteEpisodeSvc(proj, episodeId)
    const cleaned = before - Object.keys(next.assets).length
    const renum = { ...next, episodes: next.episodes.map((e, i) => ({ ...e, no: i + 1 })) }
    const firstScene = renum.episodes[0]?.sceneIds[0] ?? ''
    set({
      project: renum,
      ...reconcilePrompts(renum, s.promptStates, s.promptEdited),
      selectedSceneId: firstScene,
      sceneSettingsOpen: false,
      activeTab: 'shot',
    })
    get().showToast(`第 ${ep.no} 集已删除。本集独有的 ${cleaned} 项内容已一并删除，其他剧集使用的内容仍会保留。`)
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
