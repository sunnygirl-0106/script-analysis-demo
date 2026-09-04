// 候选资产的处理方式。
// 页面上的「三选一」（新增到资产库 / 使用已有资产 / 本次不入库）已经撤掉：
// 抽取那一步已经把同名的判重滤掉了，剩下的本来就都是要入库的新资产，不必再问一遍。
// 数据结构本身保留 —— commitCandidates 仍按 decision 分派，只是 UI 不再产出 link / skip。
import type { CandidateAsset, CandidateDecision } from '../data/types'

export interface Decision {
  decision: CandidateDecision
  linkTargetId?: string
}

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
