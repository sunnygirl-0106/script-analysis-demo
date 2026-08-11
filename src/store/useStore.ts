// Zustand：一个 project + 所有动作。不做持久化，刷新回到初始状态。
import { create } from 'zustand'
import type { MountRef, Project, Shot, ShotDensity, Stage } from '../data/types'
import { seedProject } from '../data/seed'
import { episode2Payload } from '../data/seedEpisode2'
import { appendEpisode } from '../services/incremental'
import { applyDensity, densityShots, hasDensityPresets } from '../services/density'
import { canEdit, resplitScene } from '../services/lock'
import { sceneDuration } from '../services/timeline'

export type Tab = 'character' | 'costume' | 'location' | 'prop' | 'shot'
export type ViewMode = 'brief' | 'dual'
export type Theme = 'dark' | 'light'

export interface Toast {
  id: number
  text: string
}

interface UIState {
  theme: Theme
  activePage: Stage
  selectedSceneId: string
  activeTab: Tab
  scriptOpen: boolean
  expandedShotId: string | null
  viewMode: ViewMode
  toast: Toast | null
}

interface StoreState extends UIState {
  project: Project

  // ── 派生便捷读取 ──
  currentScene: () => Project['scenes'][string] | undefined
  canEditAnalysis: () => boolean

  // ── UI 动作 ──
  toggleTheme: () => void
  setPage: (page: Stage) => void
  selectScene: (sceneId: string) => void
  setTab: (tab: Tab) => void
  toggleScript: () => void
  toggleShot: (shotId: string) => void
  setViewMode: (mode: ViewMode) => void
  showToast: (text: string) => void
  dismissToast: () => void

  // ── 数据动作（受阶段锁约束）──
  updateShotField: (shotId: string, field: keyof Shot, value: string) => void
  setShotDuration: (shotId: string, duration: number) => void
  addMount: (shotId: string, mount: MountRef) => void
  removeMount: (shotId: string, assetId: string) => void
  updateSceneTrack: (sceneId: string, patch: Partial<Project['scenes'][string]['track']>) => void
  setDensity: (density: ShotDensity) => void
  appendEpisode2: () => void
  resplit: (sceneId: string) => void
  setStage: (stage: Stage) => void
}

let toastSeq = 0

export const useStore = create<StoreState>((set, get) => ({
  project: structuredClone(seedProject),
  theme: 'dark',
  activePage: 'analysis',
  selectedSceneId: 's1',
  activeTab: 'shot',
  scriptOpen: false,
  expandedShotId: 's1_sh1',
  viewMode: 'brief',
  toast: null,

  currentScene: () => get().project.scenes[get().selectedSceneId],
  canEditAnalysis: () => canEdit(get().project, 'analysis'),

  toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
  setPage: (activePage) => set({ activePage }),
  selectScene: (sceneId) => set({ selectedSceneId: sceneId, expandedShotId: null }),
  setTab: (activeTab) => set({ activeTab }),
  toggleScript: () => set((s) => ({ scriptOpen: !s.scriptOpen })),
  toggleShot: (shotId) => set((s) => ({ expandedShotId: s.expandedShotId === shotId ? null : shotId })),
  setViewMode: (viewMode) => set({ viewMode }),
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

  setDensity: (density) => {
    if (!get().canEditAnalysis()) return
    const s = get()
    const sceneId = s.selectedSceneId
    const scene = s.project.scenes[sceneId]
    if (!scene) return
    if (!hasDensityPresets(sceneId)) {
      get().showToast('该场未准备密度预设，演示请切到「第 1 场」')
      return
    }
    const presetShots = densityShots(sceneId, density)
    const newIds = applyDensity(scene, density)
    // 合并预设镜到 shots 表（移除本场旧镜，放入新镜）
    const removed = new Set(scene.shotIds)
    const nextShots: Record<string, Shot> = {}
    for (const [id, sh] of Object.entries(s.project.shots)) {
      if (!removed.has(id)) nextShots[id] = sh
    }
    for (const sh of presetShots) nextShots[sh.id] = structuredClone(sh)
    set({
      project: {
        ...s.project,
        shotDensity: density,
        scenes: { ...s.project.scenes, [sceneId]: { ...scene, shotIds: newIds } },
        shots: nextShots,
      },
      expandedShotId: null,
    })
    const label = density === 'compact' ? '紧凑' : density === 'loose' ? '舒缓' : '标准'
    get().showToast(`已切换到「${label}」密度：本场重排为 ${newIds.length} 镜`)
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

  resplit: (sceneId) => {
    if (!get().canEditAnalysis()) return
    const reset = resplitScene(get().project, sceneId)
    // 恢复初始即恢复到「标准」这一套，密度指示器同步回标准
    const next = { ...reset, shotDensity: 'standard' as const }
    set({ project: next, expandedShotId: null })
    const scene = next.scenes[sceneId]
    get().showToast(`已重拆「${scene?.name ?? ''}」：恢复初始 ${scene?.shotIds.length ?? 0} 镜，其他场不动`)
  },

  setStage: (stage) => {
    set((s) => ({ project: { ...s.project, stage }, activePage: stage }))
    if (stage === 'visual') get().showToast('已进入视觉筹备：剧本分析整个置灰只读')
  },
}))
