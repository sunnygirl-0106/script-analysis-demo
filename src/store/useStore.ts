// Zustand：一个 project + 所有动作。不做持久化，刷新回到初始状态。
import { create } from 'zustand'
import type { MountRef, Project, Shot, ShotDensity, Stage } from '../data/types'
import { seedProject } from '../data/seed'
import { episode2Payload } from '../data/seedEpisode2'
import { appendEpisode } from '../services/incremental'
import { replaceScript as replaceScriptSvc, type ScriptPayload } from '../services/replace'
import { densityShots, hasDensityPresets, resplitSceneDensity } from '../services/density'
import { canEdit, deleteEpisode as deleteEpisodeSvc, resplitScene } from '../services/lock'
import { sceneDuration } from '../services/timeline'

export type Tab = 'character' | 'costume' | 'location' | 'prop' | 'shot'

export interface Toast {
  id: number
  text: string
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

  // ── 派生便捷读取 ──
  currentScene: () => Project['scenes'][string] | undefined
  canEditAnalysis: () => boolean
  countShotsOf: (assetId: string) => number

  // ── UI 动作 ──
  toggleNav: () => void
  setPage: (page: Stage) => void
  selectScene: (sceneId: string) => void
  setTab: (tab: Tab) => void
  toggleScript: () => void
  openSceneSettings: () => void
  closeSceneSettings: () => void
  showToast: (text: string) => void
  dismissToast: () => void

  // ── 数据动作（受阶段锁约束）──
  updateShotField: (shotId: string, field: keyof Shot, value: string) => void
  setShotDuration: (shotId: string, duration: number) => void
  addMount: (shotId: string, mount: MountRef) => void
  removeMount: (shotId: string, assetId: string) => void
  updateSceneTrack: (sceneId: string, patch: Partial<Project['scenes'][string]['track']>) => void
  appendEpisode2: () => void
  replaceScript: (payload: ScriptPayload) => void
  replaceEpisode: (episodeId: string) => void
  deleteEpisode: (episodeId: string) => void
  resplit: (sceneId: string, opts: { density?: ShotDensity; targetShots?: number }) => void
  resplitEpisode: (episodeId: string, opts: { density: ShotDensity; sceneCount?: number }) => void
  setStage: (stage: Stage) => void
}

let toastSeq = 0

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

export const useStore = create<StoreState>((set, get) => ({
  project: structuredClone(seedProject),
  activePage: 'analysis',
  selectedSceneId: 's1',
  activeTab: 'shot',
  scriptOpen: false,
  sceneSettingsOpen: false,
  navCollapsed: false,
  toast: null,

  currentScene: () => get().project.scenes[get().selectedSceneId],
  canEditAnalysis: () => canEdit(get().project, 'analysis'),
  // 遍历 shots 数「挂了该资产」的镜数。挂载会变，所以按需反查，不往 Appearance 里塞字段。
  countShotsOf: (assetId) =>
    Object.values(get().project.shots).filter((sh) => sh.mounts.some((mo) => mo.assetId === assetId))
      .length,

  toggleNav: () => set((s) => ({ navCollapsed: !s.navCollapsed })),
  setPage: (activePage) => set({ activePage }),
  // 切场时关掉场级设定抽屉（抽屉里的内容属于上一场）。
  selectScene: (sceneId) => set({ selectedSceneId: sceneId, sceneSettingsOpen: false }),
  setTab: (activeTab) => set({ activeTab }),
  toggleScript: () => set((s) => ({ scriptOpen: !s.scriptOpen })),
  openSceneSettings: () => set({ sceneSettingsOpen: true }),
  closeSceneSettings: () => set({ sceneSettingsOpen: false }),
  showToast: (text) => {
    const id = ++toastSeq
    set({ toast: { id, text } })
  },
  dismissToast: () => set({ toast: null }),

  updateShotField: (shotId, field, value) => {
    if (!get().canEditAnalysis()) return
    set((s) => {
      const shot = s.project.shots[shotId]
      if (!shot) return s
      return {
        project: { ...s.project, shots: { ...s.project.shots, [shotId]: { ...shot, [field]: value } } },
      }
    })
  },

  setShotDuration: (shotId, duration) => {
    if (!get().canEditAnalysis()) return
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
    const newSceneDur = sceneDuration(scene, nextShots)
    get().showToast(
      `第 ${shot.no} 镜 ${delta > 0 ? '+' : ''}${delta}s：后续 ${after} 个镜顺移，本场总时长变为 ${newSceneDur}s`,
    )
  },

  addMount: (shotId, mount) => {
    if (!get().canEditAnalysis()) return
    set((s) => {
      const shot = s.project.shots[shotId]
      if (!shot || shot.mounts.some((m) => m.assetId === mount.assetId)) return s
      const mounts = [...shot.mounts, mount]
      return { project: { ...s.project, shots: { ...s.project.shots, [shotId]: { ...shot, mounts } } } }
    })
  },

  removeMount: (shotId, assetId) => {
    if (!get().canEditAnalysis()) return
    set((s) => {
      const shot = s.project.shots[shotId]
      if (!shot) return s
      const mounts = shot.mounts.filter((m) => m.assetId !== assetId)
      return { project: { ...s.project, shots: { ...s.project.shots, [shotId]: { ...shot, mounts } } } }
    })
  },

  updateSceneTrack: (sceneId, patch) => {
    if (!get().canEditAnalysis()) return
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

  appendEpisode2: () => {
    if (!get().canEditAnalysis()) return
    const s = get()
    if (s.project.episodes.some((e) => e.id === 'e2')) {
      get().showToast('第 2 集已经追加过了')
      return
    }
    const next = appendEpisode(s.project, episode2Payload)
    set({ project: next })
    get().showToast('已追加第 2 集：老角色「苏可」复用，未重复；新角色「快递员」入库')
  },

  replaceScript: (payload) => {
    if (!get().canEditAnalysis()) return
    const s = get()
    const oldEp = s.project.episodes.length
    const oldShots = Object.keys(s.project.shots).length
    const next = replaceScriptSvc(s.project, payload)
    const firstScene = next.episodes[0]?.sceneIds[0] ?? ''
    set({ project: next, selectedSceneId: firstScene, sceneSettingsOpen: false, activeTab: 'shot' })
    get().showToast(`已覆盖导入「${payload.title}」：原 ${oldEp} 集 ${oldShots} 镜已丢弃`)
  },

  // 替换本集：语义诚实地实现为「删除本集 + 追加新集」。演示只有一套「新集」内容（第 2 集），
  // 若它已存在则不替换，如实告知，避免删了却补不上。
  replaceEpisode: (episodeId) => {
    if (!get().canEditAnalysis()) return
    const s = get()
    const proj = s.project
    const ep = proj.episodes.find((e) => e.id === episodeId)
    if (!ep) return
    const remaining = proj.episodes.filter((e) => e.id !== episodeId)
    if (remaining.some((e) => e.id === 'e2')) {
      get().showToast('演示数据只有一套「新集」内容，且第 2 集已存在，无法替换本集')
      return
    }
    const deleted = deleteEpisodeSvc(proj, episodeId)
    const appended = appendEpisode(deleted, episode2Payload)
    // 集号顺序整理，避免删中间集后号码跳空。
    const renum = { ...appended, episodes: appended.episodes.map((e, i) => ({ ...e, no: i + 1 })) }
    const newEp = renum.episodes.find((e) => e.id === 'e2')
    const firstScene = newEp?.sceneIds[0] ?? renum.episodes[0]?.sceneIds[0] ?? ''
    set({ project: renum, selectedSceneId: firstScene, sceneSettingsOpen: false, activeTab: 'shot' })
    get().showToast(`已替换第 ${ep.no} 集：原内容删除、按新剧本重新拆解，其他集不受影响`)
  },

  deleteEpisode: (episodeId) => {
    if (!get().canEditAnalysis()) return
    const s = get()
    const proj = s.project
    if (proj.episodes.length <= 1) {
      get().showToast('至少保留一集')
      return
    }
    const ep = proj.episodes.find((e) => e.id === episodeId)
    if (!ep) return
    const before = Object.keys(proj.assets).length
    const next = deleteEpisodeSvc(proj, episodeId)
    const cleaned = before - Object.keys(next.assets).length
    const renum = { ...next, episodes: next.episodes.map((e, i) => ({ ...e, no: i + 1 })) }
    const firstScene = renum.episodes[0]?.sceneIds[0] ?? ''
    set({ project: renum, selectedSceneId: firstScene, sceneSettingsOpen: false, activeTab: 'shot' })
    get().showToast(`已删除第 ${ep.no} 集：${cleaned} 项仅本集资产已清理，跨集资产保留`)
  },

  resplit: (sceneId, opts) => {
    if (!get().canEditAnalysis()) return
    const s = get()
    const scene = s.project.scenes[sceneId]
    if (!scene) return

    // 该场没有多套预设 → 回退到「恢复初始」。
    if (!hasDensityPresets(sceneId)) {
      const reset = resplitScene(s.project, sceneId)
      const rscene = reset.scenes[sceneId]!
      const next = { ...reset, scenes: { ...reset.scenes, [sceneId]: { ...rscene, density: 'standard' as ShotDensity } } }
      set({ project: next, sceneSettingsOpen: false })
      get().showToast('演示数据仅为第 1 场准备了多套拆解方案，本场已按原方案重新生成')
      return
    }

    // 指定镜数 → 选最接近的一套，如实说明。
    if (opts.targetShots != null && opts.density == null) {
      const density = closestDensity(sceneId, opts.targetShots)
      const next = resplitSceneDensity(s.project, sceneId, density)
      set({ project: next, sceneSettingsOpen: false })
      get().showToast(
        `已按「指定 ${opts.targetShots} 镜」重拆：演示数据中最接近的方案为「${DENSITY_LABEL[density]}」${densityShots(sceneId, density).length} 镜`,
      )
      return
    }

    // 指定颗粒度（或照原颗粒度重拆一次）。
    const density = opts.density ?? scene.density
    const next = resplitSceneDensity(s.project, sceneId, density)
    set({ project: next, sceneSettingsOpen: false })
    get().showToast(`已重拆「${scene.name}」为「${DENSITY_LABEL[density]}」${densityShots(sceneId, density).length} 镜，其他场不动`)
  },

  resplitEpisode: (episodeId, opts) => {
    if (!get().canEditAnalysis()) return
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
        applied.push(`第 ${scene.no} 场按「${DENSITY_LABEL[opts.density]}」重排为 ${proj.scenes[sid]!.shotIds.length} 镜`)
      } else {
        const reset = resplitScene(proj, sid)
        const rscene = reset.scenes[sid]!
        proj = { ...reset, scenes: { ...reset.scenes, [sid]: { ...rscene, density: 'standard' as ShotDensity } } }
        kept.push(scene.no)
      }
    }
    set({ project: proj, selectedSceneId: ep.sceneIds[0] ?? s.selectedSceneId, sceneSettingsOpen: false })

    let msg = applied.length
      ? `已重拆第 ${ep.no} 集：${applied.join('，')}`
      : `已重拆第 ${ep.no} 集`
    if (kept.length) msg += `，第 ${kept.join(' / ')} 场演示数据无多套方案，保持原方案`
    if (opts.sceneCount != null) msg += '；演示数据暂不支持重新划分场数'
    get().showToast(msg)
  },

  setStage: (stage) => {
    set((s) => ({ project: { ...s.project, stage }, activePage: stage }))
    if (stage === 'visual') get().showToast('已进入视觉筹备：剧本分析整个置灰只读')
  },
}))
