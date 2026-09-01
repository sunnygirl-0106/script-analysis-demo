// 单向传播的派生状态（决策 1c 的工程表达）。纯函数。
// 规则版本：v2.0（2026-09-01）。断言见 tests/rules.test.ts 的 R13 / R16。
// v2.0 新增 shotsAffectedByAsset：资产删/改提示词波及的镜头（只标待更新，不重生）。
//
// 剧本分析是「有哪些资产、谁出现在哪、谁穿什么」的真相源；
// 项目资产库是「图长什么样」的真相源。剧本分析改动下推，资产库改动不上推。
// 这里只负责说清楚「我改过了，下游那张图已经过期」，不负责触发重新生成。
import { FIRST_BATCH_KINDS, type Asset, type Project } from '../data/types'

export type AssetSyncState = 'draft' | 'delivered' | 'stale'
//                            未交付   已交付未改   已交付且改过 → 下游图过期

export function syncState(a: Asset): AssetSyncState {
  if (a.deliveredRevision == null) return 'draft'
  return a.promptRevision > a.deliveredRevision ? 'stale' : 'delivered'
}

/**
 * 进入资产生产：把第一批资产（FIRST_BATCH_KINDS ∩ !excluded）的 deliveredRevision
 * 对齐到当前 promptRevision（决策 6.7）。look 不在第一批，不交付。
 * 之后再改提示词会使 promptRevision > deliveredRevision ⇒ syncState 变 'stale'。
 */
export function deliverFirstBatch(project: Project): Project {
  const kinds = new Set<string>(FIRST_BATCH_KINDS)
  const assets: Record<string, Asset> = { ...project.assets }
  for (const [id, a] of Object.entries(project.assets)) {
    if (!kinds.has(a.kind) || a.excluded) continue
    assets[id] = { ...a, deliveredRevision: a.promptRevision }
  }
  return { ...project, assets }
}

/**
 * 资产被删 / 提示词被改，导致引用它的镜头的画面提示词过期（v2.0）。
 * 返回受影响的 shotId 列表，由 store 置为 'stale'。与出场索引同口径：
 * 直接挂载，或经着装角色(look)向上聚合（角色含其 look，服装含引用它的 look）。
 * ⚠ 只标记，不自动重新生成 —— v3 铁律 3。断言见 tests/rules.test.ts 的 R13。
 */
export function shotsAffectedByAsset(project: Project, assetId: string): string[] {
  const out: string[] = []
  for (const shot of Object.values(project.shots)) {
    const hit = shot.mounts.some((m) => {
      if (m.assetId === assetId) return true
      const a = project.assets[m.assetId]
      if (a && a.kind === 'look') {
        return a.characterId === assetId || a.costumeIds.includes(assetId)
      }
      return false
    })
    if (hit) out.push(shot.id)
  }
  return out
}
