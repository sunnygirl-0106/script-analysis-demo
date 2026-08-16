// 剧本导入之「覆盖重来」+ 替换本集的资产 diff。纯函数。
// 规则版本：v1.3（2026-08-15）。断言见 tests/rules.test.ts 的 R8 与 tests/replace.test.ts。
import type { Asset, Episode, Project, Scene, Shot } from '../data/types'
import { assetKey } from './incremental'

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
 * 重置：episodes / scenes / shots / assets 全换，stage 回到 'analysis'
 */
export function replaceScript(project: Project, payload: ScriptPayload): Project {
  return {
    ...project, // 保留 id / title / aspect / style / defaultDensity
    stage: 'analysis',
    episodes: payload.episodes,
    scenes: payload.scenes,
    shots: payload.shots,
    assets: payload.assets,
  }
}

/**
 * 替换本集前后的资产变化，供结果回执使用。按 kind + 归一化名称（复用 incremental 的 assetKey）匹配：
 *  reused  = 两侧都在的资产；
 *  added   = 只在 next 的资产；
 *  removed = 只在 prev、替换后 next 中已不存在（即无人引用被清理）的资产。
 */
export function episodeReplaceDiff(
  prev: Project,
  next: Project,
): { reused: number; added: number; removed: number; removedNames: string[] } {
  const prevByKey = new Map<string, Asset>()
  for (const a of Object.values(prev.assets)) prevByKey.set(assetKey(a), a)
  const nextByKey = new Map<string, Asset>()
  for (const a of Object.values(next.assets)) nextByKey.set(assetKey(a), a)

  let reused = 0
  let added = 0
  for (const key of nextByKey.keys()) {
    if (prevByKey.has(key)) reused++
    else added++
  }

  const removedNames: string[] = []
  for (const [key, a] of prevByKey) {
    if (!nextByKey.has(key)) removedNames.push(a.name)
  }

  return { reused, added, removed: removedNames.length, removedNames }
}
