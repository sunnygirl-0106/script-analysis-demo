// R9 资产完整性提示。纯函数。
// 规则版本：v1.1（2026-08-11）。断言见 tests/rules.test.ts 的 R9。
//
// 只在下面三种情况提示，其余一律不提示。**明确不提示**（不要"补全"回去）：
//   · 没有道具 → 正常，大量镜头本来就没道具
//   · 没有角色 → 正常，空镜 / 物件特写
//   · 没有服装但也没挂角色 → 正常
// 「一个镜头没挂满四类，不等于它有问题」——这是这条规则存在的全部理由。
import type { Asset, AssetKind, Costume, Shot } from '../data/types'

export type IssueLevel = 'action' | 'hint'

export interface MountIssue {
  level: IssueLevel
  text: string
  /** level==='action' 时携带：点一下就能挂上的那个资产 */
  assetId?: string
  kind?: AssetKind
}

/**
 * 从镜头文本里挑出「被点名但没挂」的资产名。
 * 匹配方式与 ScriptPanel 的高亮一致：只取 name 长度 ≥ 2 的资产，长名优先，
 * 用正则 split 后收集命中集（避免「苏可」吃掉「苏可可」）。
 */
function mentionedAssetIds(text: string, assets: Asset[]): Set<string> {
  const named = assets
    .filter((a) => a.name.length >= 2)
    .sort((a, b) => b.name.length - a.name.length)
  if (named.length === 0) return new Set()
  const escaped = named.map((a) => a.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`(${escaped.join('|')})`, 'g')
  const hitNames = new Set(text.match(re) ?? [])
  return new Set(named.filter((a) => hitNames.has(a.name)).map((a) => a.id))
}

/** 只在三种情况提示，其余一律返回空。 */
export function mountIssues(shot: Shot, assets: Record<string, Asset>): MountIssue[] {
  const list = Object.values(assets)
  const mountedIds = new Set(shot.mounts.map((m) => m.assetId))
  const issues: MountIssue[] = []

  // 规则 1：镜头文本里明确提到了某个资产名，但没挂 → 可点击挂上（本轮最好的演示动作）。
  // 只看角色 / 道具：这两类才会在原文里被点名却漏挂。场景是结构性的（一场一景、且
  // 「客厅 / 玄关 / 餐桌区」这类子空间会同时出现在提示词里），它的缺失由规则 3 单独判定，
  // 不能靠文本点名——否则餐桌区的镜头会被误报「未挂载：客厅」，正是本轮要消灭的噪声。
  const text = [shot.title, shot.imagePrompt, shot.videoPrompt, shot.sourceQuote].join(' ')
  const nameable = list.filter((a) => a.kind === 'character' || a.kind === 'prop')
  const mentioned = mentionedAssetIds(text, nameable)
  for (const id of mentioned) {
    if (mountedIds.has(id)) continue
    const asset = assets[id]!
    issues.push({ level: 'action', text: `未挂载：${asset.name}`, assetId: id, kind: asset.kind })
  }

  // 规则 2：挂了某角色，但没挂任何 characterId 指向他的服装 → 灰字提示。
  const mountedCostumes = shot.mounts
    .filter((m) => m.kind === 'costume')
    .map((m) => assets[m.assetId] as Costume | undefined)
    .filter((c): c is Costume => !!c)
  for (const m of shot.mounts) {
    if (m.kind !== 'character') continue
    const char = assets[m.assetId]
    if (!char) continue
    const hasCostume = mountedCostumes.some((c) => c.characterId === m.assetId)
    if (!hasCostume) issues.push({ level: 'hint', text: `${char.name}未指定服装` })
  }

  // 规则 3：mounts 里没有任何 location → 灰字提示。
  if (!shot.mounts.some((m) => m.kind === 'location')) {
    issues.push({ level: 'hint', text: '未指定场景' })
  }

  return issues
}
