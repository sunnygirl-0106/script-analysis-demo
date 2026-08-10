// R6 阶段锁与重拆。纯函数。
// 规则版本：v1.0（2026-08-10）。断言见 tests/rules.test.ts 的 R6。
import type { Project, Shot, Stage } from '../data/types'
import { initialSceneShots } from '../data/seed'

const ORDER: Stage[] = ['analysis', 'visual', 'studio']
const rank = (s: Stage) => ORDER.indexOf(s)

/**
 * 某个阶段的内容是否还能编辑：项目一旦推进到该阶段之后，就锁死。
 * stage 推进到 visual 后，canEdit(project,'analysis') 返回 false。
 */
export function canEdit(project: Project, stage: Stage): boolean {
  return rank(project.stage) <= rank(stage)
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
