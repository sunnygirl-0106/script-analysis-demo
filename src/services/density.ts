// 重拆颗粒度。纯函数。密度是 resplit 的参数，颗粒度下沉到 Scene.density。
import type { Project, Scene, Shot, ShotDensity } from '../data/types'
import { shotPresets } from '../data/shotPresets'

/**
 * 取某场某密度对应的整套镜（完整 Shot 对象）。
 * 没有该场的预设，或没有该密度的预设时，回退到「标准」/ 空。
 */
export function densityShots(sceneId: string, density: ShotDensity): Shot[] {
  const scenePresets = shotPresets[sceneId]
  if (!scenePresets) return []
  return scenePresets[density] ?? scenePresets.standard ?? []
}

/** 是否为该场准备了密度预设。没有则切换密度时保持原样。 */
export function hasDensityPresets(sceneId: string): boolean {
  return Boolean(shotPresets[sceneId])
}

/**
 * 从 shotPresets 里取对应那套预设替换本场的镜，返回新的 shotIds。
 * 切换后时间轴由 computeTimeline 重算。
 */
export function applyDensity(scene: Scene, density: ShotDensity): string[] {
  const preset = densityShots(scene.id, density)
  if (preset.length === 0) return scene.shotIds // 无预设，保持原样
  return preset.map((s) => s.id)
}

/**
 * 按指定颗粒度重拆某场：替换本场镜、写入 scene.density，其他场一律不动（shotIds 引用保持）。
 * 供 store.resplit / resplitEpisode 复用；纯函数。
 */
export function resplitSceneDensity(project: Project, sceneId: string, density: ShotDensity): Project {
  const scene = project.scenes[sceneId]
  if (!scene) return project
  const presetShots = densityShots(sceneId, density)
  const newIds = applyDensity(scene, density)
  const removed = new Set(scene.shotIds)
  const nextShots: Record<string, Shot> = {}
  for (const [id, sh] of Object.entries(project.shots)) {
    if (!removed.has(id)) nextShots[id] = sh
  }
  for (const sh of presetShots) nextShots[sh.id] = structuredClone(sh)
  return {
    ...project,
    scenes: { ...project.scenes, [sceneId]: { ...scene, shotIds: newIds, density } },
    shots: nextShots,
  }
}
