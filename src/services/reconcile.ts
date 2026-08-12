// 改剧本后的收敛函数（决策 1c / 4.3）。纯函数。
// 规则版本：v1.2（2026-08-12）。断言见 tests/rules.test.ts 的 R13。
//
// editScript 类动作（重拆 / 追加 / 替换 / 删集）执行后统一走这里：
// 重建出场索引，并标出孤儿资产（不再被任何镜头挂载）。
// ⚠ 绝不自动删除已交付的资产 —— 下游可能已出图、已扣星钻。删除权交给用户手动。
import type { Project } from '../data/types'
import { buildUsageIndex, type AssetUsage } from './appearanceIndex'

export interface ReconcileResult {
  project: Project
  added: string[]      // 新入库的资产 id（相对 prev）
  orphaned: string[]   // 不再被任何镜头挂载的资产 id
  index: Record<string, AssetUsage>
}

/**
 * 剧本变动后重建索引，并标出孤儿资产。
 * @param project 变动后的 project
 * @param prev    变动前的 project（用于算 added；可省略）
 */
export function reconcile(project: Project, prev?: Project): ReconcileResult {
  const index = buildUsageIndex(project)

  const orphaned = Object.keys(project.assets).filter((id) => (index[id]?.shotCount ?? 0) === 0)

  const prevIds = prev ? new Set(Object.keys(prev.assets)) : new Set<string>()
  const added = prev ? Object.keys(project.assets).filter((id) => !prevIds.has(id)) : []

  return { project, added, orphaned, index }
}
