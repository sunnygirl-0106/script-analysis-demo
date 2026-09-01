// 重拆与删集。纯函数。deleteEpisode：只删集的结构与镜头，资产库一条不动（v2.0）。
// 规则版本：v2.0（2026-09-01）。断言见 tests/rules.test.ts 的 R7。
// canEdit 已废除（决策 1a）—— 全局阶段锁改为 services/capability.ts 的 can(project, cap)。
import type { Project, Shot } from '../data/types'
import { initialSceneShots } from '../data/seed'

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
 * 资产：一条都不动。删集只删结构与镜头；本集独有的资产会因为不再被任何镜头挂载
 * 而变成「当前剧本未引用」（services/appearanceIndex 的 shotCount === 0），但仍留在库里。
 * 其他集的 episodes / scenes / shots 保持原引用。
 * 不在此处做「至少保留一集」的守卫——那是调用方（store）的职责。
 */
export function deleteEpisode(project: Project, episodeId: string): Project {
  const ep = project.episodes.find((e) => e.id === episodeId)
  if (!ep) return project

  const sceneIds = ep.sceneIds
  const shotIds = sceneIds.flatMap((id) => project.scenes[id]?.shotIds ?? [])

  const nextScenes = { ...project.scenes }
  for (const id of sceneIds) delete nextScenes[id]
  const nextShots = { ...project.shots }
  for (const id of shotIds) delete nextShots[id]

  return {
    ...project,
    episodes: project.episodes.filter((e) => e.id !== episodeId),
    scenes: nextScenes,
    shots: nextShots,
    assets: project.assets, // ★ v2.0：删集不动资产库。只增不减的删除出口只有项目资产库。
  }
}
