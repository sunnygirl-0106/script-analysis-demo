// 第一批资产生产：筛选、快照、过期判断、依赖影响。纯函数。
//
// 单向数据流：剧本分析（源）──生成/重新同步──> 视觉筹备/项目资产库（下游副本）。
// 上游改提示词只让下游「过期/待重新同步」，不读取或覆盖下游的用户改动。
// 本 Demo 在仓库内维护最小生产快照与过期状态；未来接真实资产库时沿用相同语义。
import type {
  Asset,
  BaseAssetKind,
  Character,
  Costume,
  Location,
  Project,
  ProductionSnapshot,
  Prop,
} from '../data/types'
import { looksOfCharacter, looksUsingCostume } from './looks'

export type BaseAsset = Character | Costume | Location | Prop

const BASE_KINDS = new Set<BaseAssetKind>(['character', 'costume', 'location', 'prop'])
function isBaseAsset(a: Asset): a is BaseAsset {
  return a.kind !== 'look'
}

/** 是否需要重新生产：进入过快照且此后 revision 又被抬高。 */
export function isProductionStale(a: Asset): boolean {
  return a.productionRevision != null && a.revision > a.productionRevision
}

/**
 * 第一批生产清单：只返回角色 / 服装 / 场景 / 道具四类基础资产，永远排除 look。
 */
export function firstBatchAssets(project: Project): BaseAsset[] {
  return Object.values(project.assets).filter(isBaseAsset)
}

/** 用当前四类基础资产生成一份生产快照（下游副本，与上游对象不共用可变引用）。 */
export function buildProductionSnapshot(project: Project): ProductionSnapshot {
  const items = firstBatchAssets(project).map((a) => ({
    sourceAssetId: a.id,
    kind: a.kind as BaseAssetKind,
    name: a.name,
    prompt: a.imagePrompt,
    sourceRevision: a.revision,
  }))
  return {
    createdAt: Date.now(),
    sourceScriptRevision: project.scriptRevision,
    items,
  }
}

/** 相对已有快照，哪些资产的提示词已被改动（下游过期）。返回 sourceAssetId 列表。 */
export function staleProductionItems(project: Project): string[] {
  const snap = project.productionSnapshot
  if (!snap) return []
  return snap.items
    .filter((it) => {
      const a = project.assets[it.sourceAssetId]
      return !!a && a.revision > it.sourceRevision
    })
    .map((it) => it.sourceAssetId)
}

/** 脚本是否已在下发快照之后被修改（用于「脚本已修改，后续流程需重新同步」提示）。 */
export function isScriptStale(project: Project): boolean {
  const snap = project.productionSnapshot
  return !!snap && project.scriptRevision > snap.sourceScriptRevision
}

/**
 * 改某个基础资产提示词时，依赖它、需要跟着失效的着装角色 id：
 *   · 角色 → 引用它的全部 Look。
 *   · 服装 → 引用它的全部 Look。
 *   · 场景 / 道具 / look → 不牵连其他基础资产，返回空。
 */
export function affectedLooks(assetId: string, assets: Record<string, Asset>): string[] {
  const a = assets[assetId]
  if (!a) return []
  if (a.kind === 'character') return looksOfCharacter(assetId, assets).map((l) => l.id)
  if (a.kind === 'costume') return looksUsingCostume(assetId, assets).map((l) => l.id)
  return []
}

// 供 UI 判断类别用。
export { BASE_KINDS }
