// Zustand：一个 project + 所有动作。不做持久化，刷新回到初始状态。
import { create } from 'zustand'
import type { MountRef, Project, Shot, ShotDensity, Stage } from '../data/types'
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
  showToast: (text: string) => void
  dismissToast: () => void

  // ── 数据动作（受能力矩阵 can(project, cap) 约束）──
  updateShotField: (shotId: string, field: keyof Shot, value: string) => void
  setShotDuration: (shotId: string, duration: number) => void
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
  showToast: (text) => {
    const id = ++toastSeq
    set({ toast: { id, text } })
  },
  dismissToast: () => set({ toast: null }),

  updateShotField: (shotId, field, value) => {
    if (!can(get().project, 'editShotFields')) return
    set((s) => {
      const shot = s.project.shots[shotId]
      if (!shot) return s
      return {
        project: { ...s.project, shots: { ...s.project.shots, [shotId]: { ...shot, [field]: value } } },
      }
    })
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
    const newSceneDur = sceneDuration(scene, nextShots)
    get().showToast(
      `第 ${shot.no} 镜 ${delta > 0 ? '+' : ''}${delta}s：后续 ${after} 个镜顺移，本场总时长变为 ${newSceneDur}s`,
    )
  },

  addMount: (shotId, mount) => {
    if (!can(get().project, 'editMounts')) return
    set((s) => {
      const shot = s.project.shots[shotId]
      if (!shot || shot.mounts.some((m) => m.assetId === mount.assetId)) return s
      const mounts = [...shot.mounts, mount]
      return { project: { ...s.project, shots: { ...s.project.shots, [shotId]: { ...shot, mounts } } } }
    })
  },

  removeMount: (shotId, assetId) => {
    if (!can(get().project, 'editMounts')) return
    set((s) => {
      const shot = s.project.shots[shotId]
      if (!shot) return s
      const mounts = shot.mounts.filter((m) => m.assetId !== assetId)
      return { project: { ...s.project, shots: { ...s.project.shots, [shotId]: { ...shot, mounts } } } }
    })
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
      get().showToast('第 2 集已经追加过了')
      return
    }
    const next = appendEpisode(s.project, episode2Payload)
    set({ project: next })
    get().showToast('已追加第 2 集：老角色「苏可」复用，未重复；新角色「快递员」入库')
  },

  replaceScript: (payload) => {
    if (!can(get().project, 'editScript')) return
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
    if (!can(get().project, 'editScript')) return
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
    if (!can(get().project, 'editScript')) return
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
    if (!can(get().project, 'editScript')) return
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
    set((s) => {
      // 进入视觉筹备：把第一批资产的 deliveredRevision 对齐到 promptRevision（决策 6.7）。
      const project = stage === 'visual' ? deliverFirstBatch({ ...s.project, stage }) : { ...s.project, stage }
      return { project, activePage: stage }
    })
    if (stage === 'visual') get().showToast('已进入视觉筹备：提示词与剧本仍可修改，绑定关系不可改')
  },
}))
