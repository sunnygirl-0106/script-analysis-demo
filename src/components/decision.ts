// 候选资产的「三选一」处理方式（v2.4 §4.3）。
// 原先长在 AssetPrecheck 里，那个组件本轮退役；三选一本身没退役，
// 它搬到步骤② 资产确认页的候选行上——已入库之后，新候选的「状态」列就是这个下拉。
import type { CandidateAsset, CandidateDecision } from '../data/types'

export interface Decision {
  decision: CandidateDecision
  linkTargetId?: string
}

export const DECISION_META: { key: CandidateDecision; label: string; sub: string }[] = [
  { key: 'new', label: '新增到资产库', sub: '创建一条新资产，本次及后续分镜都能用' },
  { key: 'link', label: '使用已有资产', sub: '选一个已有资产替代它' },
  { key: 'skip', label: '本次不入库', sub: '分镜里保留这段文字，但不形成资产引用、不带图片' },
]

/** 把候选按当前 decisions 折叠成最终待结算候选（确认时调用）。未表态的按默认「新增」。 */
export function applyDecisions(
  cands: CandidateAsset[],
  decisions: Record<string, Decision>,
): CandidateAsset[] {
  return cands.map((c) => {
    const d = decisions[c.tempId] ?? { decision: 'new' as CandidateDecision }
    return { ...c, decision: d.decision, linkTargetId: d.linkTargetId }
  })
}
