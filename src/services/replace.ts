// 剧本导入之「覆盖重来」。纯函数。
import type { Asset, Episode, Project, Scene, Shot } from '../data/types'

/** 一份完整的新剧本载荷（覆盖导入用；title 仅用于 toast，不写回 project）。 */
export interface ScriptPayload {
  title: string
  episodes: Episode[]
  scenes: Record<string, Scene>
  shots: Record<string, Shot>
  assets: Record<string, Asset>
}

/**
 * 覆盖导入：整个解析结果换成新剧本。
 * 保留：project.id / title / aspect / style / defaultDensity（这些是用户的项目级设置）
 * 重置：episodes / scenes / shots / assets 全换，stage 回到 'analysis'，
 *       scriptRevision 归 1、丢弃上一份生产快照（换的是全新项目，下游从头再来）。
 */
export function replaceScript(project: Project, payload: ScriptPayload): Project {
  return {
    ...project, // 保留 id / title / aspect / style / defaultDensity
    stage: 'analysis',
    scriptRevision: 1,
    productionSnapshot: undefined,
    episodes: payload.episodes,
    scenes: payload.scenes,
    shots: payload.shots,
    assets: payload.assets,
  }
}
