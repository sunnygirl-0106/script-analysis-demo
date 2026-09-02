// 生成弹窗的范围求解与默认勾选。纯函数，不碰 UI。
import type { Project, PromptState } from '../data/types'

export type PromptScope = 'scene' | 'episode' | 'project'

/** 求某范围内的全部镜头 id，按「集 → 场 → 镜」自然序返回。
 *  scene 只含 sceneId 那一场；episode 含 sceneId 所属集的全部场；project 覆盖全剧。 */
export function shotIdsOfScope(project: Project, scope: PromptScope, sceneId: string): string[] {
  const out: string[] = []
  const targetEp =
    scope === 'episode'
      ? project.episodes.find((e) => e.sceneIds.includes(sceneId))
      : undefined
  for (const ep of project.episodes) {
    if (scope === 'episode' && ep !== targetEp) continue
    for (const scId of ep.sceneIds) {
      if (scope === 'scene' && scId !== sceneId) continue
      for (const shId of project.scenes[scId]?.shotIds ?? []) out.push(shId)
    }
  }
  return out
}

/** 默认勾选规则：pending / stale 勾选，ready 不勾选，generating 不勾选且不可选。 */
export function defaultSelection(ids: string[], states: Record<string, PromptState>): Set<string> {
  const sel = new Set<string>()
  for (const id of ids) {
    const st = states[id] ?? 'pending'
    if (st === 'pending' || st === 'stale') sel.add(id)
  }
  return sel
}

/** 把范围内镜头按「集 → 场」分组，供弹窗渲染。只保留至少含一个入参镜头的场。 */
export function groupByScene(
  project: Project,
  ids: string[],
): Array<{ episodeNo: number; sceneId: string; sceneNo: number; sceneName: string; shotIds: string[] }> {
  const set = new Set(ids)
  const groups: Array<{
    episodeNo: number
    sceneId: string
    sceneNo: number
    sceneName: string
    shotIds: string[]
  }> = []
  for (const ep of project.episodes) {
    for (const scId of ep.sceneIds) {
      const scene = project.scenes[scId]
      if (!scene) continue
      const shotIds = scene.shotIds.filter((id) => set.has(id))
      if (!shotIds.length) continue
      groups.push({
        episodeNo: ep.no,
        sceneId: scId,
        sceneNo: scene.no,
        sceneName: scene.name,
        shotIds,
      })
    }
  }
  return groups
}
