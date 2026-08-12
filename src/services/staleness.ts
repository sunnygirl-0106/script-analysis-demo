// 单向传播的派生状态（决策 1c 的工程表达）。纯函数。
// 规则版本：v1.2（2026-08-12）。断言见 tests/rules.test.ts 的 R13。
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
