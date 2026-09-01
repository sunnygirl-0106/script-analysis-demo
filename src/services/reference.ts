// 当前剧本引用态。纯函数。
// 规则版本：v2.0（2026-09-01）。断言见 tests/rules.test.ts 的 R16。
//
// 「删场 / 删集不删资产」这条口径的可视化出口：资产是否仍被当前剧本的任何镜头挂载，
// 完全由派生索引（appearanceIndex）说了算 —— 不引入任何存储字段（见 §3.2）。
import type { AssetUsage } from './appearanceIndex'

export type RefState = 'referenced' | 'unreferenced'

/** 某资产是否仍被当前剧本的任何镜头挂载。
 *  角色 / 服装走 appearanceIndex 已有的并集口径（角色含其 look，服装含引用它的 look）。 */
export function refState(index: Record<string, AssetUsage>, assetId: string): RefState {
  return (index[assetId]?.shotCount ?? 0) > 0 ? 'referenced' : 'unreferenced'
}

/** 全库统计，供 toast 与概览条使用。仅统计索引里出现的资产 id。 */
export function unreferencedCount(index: Record<string, AssetUsage>): number {
  let n = 0
  for (const id of Object.keys(index)) {
    if (refState(index, id) === 'unreferenced') n++
  }
  return n
}
