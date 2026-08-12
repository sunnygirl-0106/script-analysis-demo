// Zustand：一个 project + 所有动作。不做持久化，刷新回到初始状态。
import { create } from 'zustand'
import type { Asset, MountRef, Project, Shot, ShotDensity, Stage } from '../data/types'
import { seedProject } from '../data/seed'
import { episode2Payload } from '../data/seedEpisode2'
import { appendEpisode } from '../services/incremental'
import { replaceScript as replaceScriptSvc, type ScriptPayload } from '../services/replace'
import { densityShots, hasDensityPresets, resplitSceneDensity } from '../services/density'
import { deleteEpisode as deleteEpisodeSvc, resplitScene } from '../services/lock'
import { affectedLooks, buildProductionSnapshot } from '../services/production'
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
  producedIds: string[] // Demo：已在视觉筹备里点过「已生成」的资产（仅演示用）
}

interface StoreState extends UIState {
  project: Project

  // ── 派生便捷读取 ──
  currentScene: () => Project['scenes'][string] | undefined
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

  // ── 脚本 / 分镜修改（成功改动后统一 scriptRevision + 1）──
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

  // ── 资产提示词修改与单向生产 ──
  updateAssetPrompt: (assetId: string, prompt: string) => void
  startAssetProduction: () => void
  markAssetProduced: (assetId: string) => void

  setStage: (stage: Stage) => void
}

let toastSeq = 0

/** 脚本/分镜修改成功后，抬升 scriptRevision（下游据此判断「脚本已修改，需重新同步」）。 */
const bumpScript = (proj: Project): Project => ({ ...proj, scriptRevision: proj.scriptRevision + 1 })

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
  producedIds: [],

  currentScene: () => get().project.scenes[get().selectedSceneId],
  // 遍历 shots 数「挂了该资产」的镜数。挂载会变，所以按需反查，不往 Appearance 里塞字段。
  // 对角色/服装：它们不再直接挂载，改为反查「挂了引用它的着装角色」的镜数。
  countShotsOf: (assetId) => {
    const { assets, shots } = get().project
    const asset = assets[assetId]
    const shotList = Object.values(shots)
    if (asset && (asset.kind === 'character' || asset.kind === 'costume')) {
      const lookIds = new Set(
        Object.values(assets)
          .filter((a) => a.kind === 'look')
          .filter((l) => (asset.kind === 'character' ? l.characterId === assetId : l.costumeId === assetId))
          .map((l) => l.id),
      )
      return shotList.filter((sh) => sh.mounts.some((mo) => lookIds.has(mo.assetId))).length
    }
    return shotList.filter((sh) => sh.mounts.some((mo) => mo.assetId === assetId)).length
  },

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
    set((s) => {
      const shot = s.project.shots[shotId]
      if (!shot) return s
      const next = { ...s.project, shots: { ...s.project.shots, [shotId]: { ...shot, [field]: value } } }
      return { project: bumpScript(next) }
    })
  },

  setShotDuration: (shotId, duration) => {
    const s = get()
    const shot = s.project.shots[shotId]
    if (!shot) return
    const clamped = Math.max(1, Math.round(duration))
    const delta = clamped - shot.duration
    if (delta === 0) return
    const nextShots = { ...s.project.shots, [shotId]: { ...shot, duration: clamped } }
    const scene = s.project.scenes[shot.sceneId]!
    const after = scene.shotIds.slice(scene.shotIds.indexOf(shotId) + 1).length
    set({ project: bumpScript({ ...s.project, shots: nextShots }) })
    const newSceneDur = sceneDuration(scene, nextShots)
    get().showToast(
      `第 ${shot.no} 镜 ${delta > 0 ? '+' : ''}${delta}s：后续 ${after} 个镜顺移，本场总时长变为 ${newSceneDur}s`,
    )
  },

  addMount: (shotId, mount) => {
    set((s) => {
      const shot = s.project.shots[shotId]
      if (!shot || shot.mounts.some((m) => m.assetId === mount.assetId)) return s
      const mounts = [...shot.mounts, mount]
      return { project: bumpScript({ ...s.project, shots: { ...s.project.shots, [shotId]: { ...shot, mounts } } }) }
    })
  },

  removeMount: (shotId, assetId) => {
    set((s) => {
      const shot = s.project.shots[shotId]
      if (!shot) return s
      const mounts = shot.mounts.filter((m) => m.assetId !== assetId)
      return { project: bumpScript({ ...s.project, shots: { ...s.project.shots, [shotId]: { ...shot, mounts } } }) }
    })
  },

  updateSceneTrack: (sceneId, patch) => {
    set((s) => {
      const scene = s.project.scenes[sceneId]
      if (!scene) return s
      const next = {
        ...s.project,
        scenes: { ...s.project.scenes, [sceneId]: { ...scene, track: { ...scene.track, ...patch } } },
      }
      return { project: bumpScript(next) }
    })
  },

  appendEpisode2: () => {
    const s = get()
    if (s.project.episodes.some((e) => e.id === 'e2')) {
      get().showToast('第 2 集已经追加过了')
      return
    }
    const next = appendEpisode(s.project, episode2Payload)
    set({ project: bumpScript(next) })
    get().showToast('已追加第 2 集：老角色「苏可」复用，未重复；新角色「快递员」入库')
  },

  replaceScript: (payload) => {
    const s = get()
    const oldEp = s.project.episodes.length
    const oldShots = Object.keys(s.project.shots).length
    const next = replaceScriptSvc(s.project, payload) // 内部已重置 scriptRevision / 快照
    const firstScene = next.episodes[0]?.sceneIds[0] ?? ''
    set({ project: next, selectedSceneId: firstScene, sceneSettingsOpen: false, activeTab: 'shot', producedIds: [] })
    get().showToast(`已覆盖导入「${payload.title}」：原 ${oldEp} 集 ${oldShots} 镜已丢弃`)
  },

  // 替换本集：语义诚实地实现为「删除本集 + 追加新集」。演示只有一套「新集」内容（第 2 集），
  // 若它已存在则不替换，如实告知，避免删了却补不上。
  replaceEpisode: (episodeId) => {
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
    set({ project: bumpScript(renum), selectedSceneId: firstScene, sceneSettingsOpen: false, activeTab: 'shot' })
    get().showToast(`已替换第 ${ep.no} 集：原内容删除、按新剧本重新拆解，其他集不受影响`)
  },

  deleteEpisode: (episodeId) => {
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
    set({ project: bumpScript(renum), selectedSceneId: firstScene, sceneSettingsOpen: false, activeTab: 'shot' })
    get().showToast(`已删除第 ${ep.no} 集：${cleaned} 项仅本集资产已清理，跨集资产保留`)
  },

  resplit: (sceneId, opts) => {
    const s = get()
    const scene = s.project.scenes[sceneId]
    if (!scene) return

    // 该场没有多套预设 → 回退到「恢复初始」。
    if (!hasDensityPresets(sceneId)) {
      const reset = resplitScene(s.project, sceneId)
      const rscene = reset.scenes[sceneId]!
      const next = { ...reset, scenes: { ...reset.scenes, [sceneId]: { ...rscene, density: 'standard' as ShotDensity } } }
      set({ project: bumpScript(next), sceneSettingsOpen: false })
      get().showToast('演示数据仅为第 1 场准备了多套拆解方案，本场已按原方案重新生成')
      return
    }

    // 指定镜数 → 选最接近的一套，如实说明。
    if (opts.targetShots != null && opts.density == null) {
      const density = closestDensity(sceneId, opts.targetShots)
      const next = resplitSceneDensity(s.project, sceneId, density)
      set({ project: bumpScript(next), sceneSettingsOpen: false })
      get().showToast(
        `已按「指定 ${opts.targetShots} 镜」重拆：演示数据中最接近的方案为「${DENSITY_LABEL[density]}」${densityShots(sceneId, density).length} 镜`,
      )
      return
    }

    // 指定颗粒度（或照原颗粒度重拆一次）。
    const density = opts.density ?? scene.density
    const next = resplitSceneDensity(s.project, sceneId, density)
    set({ project: bumpScript(next), sceneSettingsOpen: false })
    get().showToast(`已重拆「${scene.name}」为「${DENSITY_LABEL[density]}」${densityShots(sceneId, density).length} 镜，其他场不动`)
  },

  resplitEpisode: (episodeId, opts) => {
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
    set({ project: bumpScript(proj), selectedSceneId: ep.sceneIds[0] ?? s.selectedSceneId, sceneSettingsOpen: false })

    let msg = applied.length
      ? `已重拆第 ${ep.no} 集：${applied.join('，')}`
      : `已重拆第 ${ep.no} 集`
    if (kept.length) msg += `，第 ${kept.join(' / ')} 场演示数据无多套方案，保持原方案`
    if (opts.sceneCount != null) msg += '；演示数据暂不支持重新划分场数'
    get().showToast(msg)
  },

  // 资产提示词修改（单向）：更新提示词 + revision，不动参考关系、不动已有生产快照。
  updateAssetPrompt: (assetId, prompt) => {
    set((s) => {
      const asset = s.project.assets[assetId]
      if (!asset || asset.imagePrompt === prompt) return s
      const nextAssets: Record<string, Asset> = { ...s.project.assets }
      nextAssets[assetId] = { ...asset, imagePrompt: prompt, revision: asset.revision + 1 } as Asset
      // 角色 / 服装：给依赖它们的着装角色抬 revision，只作失效标记，不改其提示词与参考关系。
      if (asset.kind === 'character' || asset.kind === 'costume') {
        for (const lookId of affectedLooks(assetId, s.project.assets)) {
          const lk = nextAssets[lookId]
          if (lk) nextAssets[lookId] = { ...lk, revision: lk.revision + 1 } as Asset
        }
      }
      // 从「已生成」集合里剔除刚被改动的资产（Demo 状态回到待重新生成）。
      const producedIds = s.producedIds.filter((id) => id !== assetId)
      return { project: { ...s.project, assets: nextAssets }, producedIds }
    })
  },

  // 开始第一批生产：用当前四类基础资产生成快照并下发，推进到视觉筹备。着装角色不入本次快照。
  startAssetProduction: () => {
    set((s) => {
      const snapshot = buildProductionSnapshot(s.project)
      const nextAssets: Record<string, Asset> = { ...s.project.assets }
      for (const it of snapshot.items) {
        const a = nextAssets[it.sourceAssetId]
        if (a) nextAssets[it.sourceAssetId] = { ...a, productionRevision: a.revision } as Asset
      }
      return {
        project: { ...s.project, assets: nextAssets, productionSnapshot: snapshot, stage: 'visual' },
        activePage: 'visual',
        producedIds: [],
      }
    })
    get().showToast(`已开始第一批生产：${get().project.productionSnapshot?.items.length ?? 0} 项基础资产进入视觉筹备`)
  },

  markAssetProduced: (assetId) => {
    set((s) => (s.producedIds.includes(assetId) ? s : { producedIds: [...s.producedIds, assetId] }))
  },

  setStage: (stage) => {
    set((s) => ({ project: { ...s.project, stage }, activePage: stage }))
  },
}))
