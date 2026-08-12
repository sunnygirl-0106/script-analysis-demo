// 重拆与删集。纯函数。deleteEpisode：删集 + 只清「仅在该集出现」的资产，跨集资产保留。
// 规则版本：v1.2（2026-08-12）。
// canEdit 已废除（决策 1a）—— 全局阶段锁改为 services/capability.ts 的 can(project, cap)。
import type { Asset, Project, Shot } from '../data/types'
import { initialSceneShots } from '../data/seed'
import { buildUsageIndex } from './appearanceIndex'

/**
 * 重拆某场：把该场的镜恢复成 seed 里的初始状态，其他场一律不动。
 * 其他场的 shotIds 数组保持原引用。
 */
export function resplitScene(project: Project, sceneId: string): Project {
  const scene = project.scenes[sceneId]
  if (!scene) return project

  const initial = initialSceneShots(sceneId)
  if (initial.shotIds.length === 0) return project // 非 seed 场，无初始可恢复

  // 新的 shots 表：先移除本场现有的镜，再放回初始镜。
  const nextShots: Record<string, Shot> = {}
  const removed = new Set(scene.shotIds)
  for (const [id, shot] of Object.entries(project.shots)) {
    if (!removed.has(id)) nextShots[id] = shot
  }
  for (const [id, shot] of Object.entries(initial.shots)) {
    nextShots[id] = shot
  }

  return {
    ...project,
    scenes: {
      ...project.scenes,
      [sceneId]: { ...scene, shotIds: initial.shotIds },
    },
    shots: nextShots,
  }
}

/**
 * 删除一集：连同它的场、镜一并移除。
 * 资产清理：只删「出场全部落在该集」的资产；跨集出现的一律保留（去重思路的反向应用）。
 * 出场由 mounts 派生（buildUsageIndex），在删除前基于当前索引判定。
 * 其他集的 episodes / scenes / shots 保持原引用。
 * 不在此处做「至少保留一集」的守卫——那是调用方（store）的职责。
 */
export function deleteEpisode(project: Project, episodeId: string): Project {
  const ep = project.episodes.find((e) => e.id === episodeId)
  if (!ep) return project

  const sceneIds = ep.sceneIds
  const shotIds = sceneIds.flatMap((id) => project.scenes[id]?.shotIds ?? [])
  const epNo = ep.no

  // 基于删除前的派生索引判定「仅本集出现」。
  const index = buildUsageIndex(project)
  const nextAssets: Record<string, Asset> = {}
  for (const [id, a] of Object.entries(project.assets)) {
    const apps = index[id]?.appearances ?? []
    const allInThisEp = apps.length > 0 && apps.every((ap) => ap.episodeNo === epNo)
    if (!allInThisEp) nextAssets[id] = a // 跨集或无出场记录 → 保留
  }

  const nextScenes = { ...project.scenes }
  for (const id of sceneIds) delete nextScenes[id]
  const nextShots = { ...project.shots }
  for (const id of shotIds) delete nextShots[id]

  return {
    ...project,
    episodes: project.episodes.filter((e) => e.id !== episodeId),
    scenes: nextScenes,
    shots: nextShots,
    assets: nextAssets,
  }
}
