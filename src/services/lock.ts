// 阶段锁与重拆。纯函数。deleteEpisode：删集 + 只清「仅在该集出现」的资产，跨集资产保留。
import type { Asset, Project, Shot, Stage } from '../data/types'
import { initialSceneShots } from '../data/seed'

const ORDER: Stage[] = ['analysis', 'visual', 'studio']
const rank = (s: Stage) => ORDER.indexOf(s)

/**
 * 阶段先后比较（保留给需要判断「谁在前谁在后」的地方）。
 * ⚠ 不要再用它做「整页只读」判断：进入 visual 后剧本分析依然可编辑，
 * 修改只让下游过期（见 services/production.ts），编辑权限改由 analysisPermissions 表达。
 */
export function canEdit(project: Project, stage: Stage): boolean {
  return rank(project.stage) <= rank(stage)
}

/**
 * 字段级编辑权限。取代旧的整页 readOnly。
 * 当前版本：脚本与五类提示词恒可编辑；只有着装角色内部的角色—服装参考关系恒定只读。
 * 保留此函数是为了让 UI 不再散落 `stage === ...` 判断，并方便以后接入项目级权限。
 */
export interface AnalysisPermissions {
  canEditScript: boolean
  canEditCharacterPrompt: boolean
  canEditCostumePrompt: boolean
  canEditLookPrompt: boolean
  canEditLocationPrompt: boolean
  canEditPropPrompt: boolean
  canEditReferenceRelation: false
}

export function analysisPermissions(_project: Project): AnalysisPermissions {
  return {
    canEditScript: true,
    canEditCharacterPrompt: true,
    canEditCostumePrompt: true,
    canEditLookPrompt: true,
    canEditLocationPrompt: true,
    canEditPropPrompt: true,
    canEditReferenceRelation: false,
  }
}

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
 * 资产清理：只删「appearances 全部落在该集」的资产；跨集出现的一律保留
 *（去重思路的反向应用）。其他集的 episodes / scenes / shots 保持原引用。
 * 不在此处做「至少保留一集」的守卫——那是调用方（store）的职责。
 */
export function deleteEpisode(project: Project, episodeId: string): Project {
  const ep = project.episodes.find((e) => e.id === episodeId)
  if (!ep) return project

  const sceneIds = ep.sceneIds
  const shotIds = sceneIds.flatMap((id) => project.scenes[id]?.shotIds ?? [])
  const epNo = ep.no

  const nextAssets: Record<string, Asset> = {}
  for (const [id, a] of Object.entries(project.assets)) {
    const allInThisEp = a.appearances.length > 0 && a.appearances.every((ap) => ap.episodeNo === epNo)
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
