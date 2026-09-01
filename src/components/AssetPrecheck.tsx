import { useEffect, useState, type ReactNode } from 'react'
import type { Asset, AssetKind, CandidateAsset, CandidateDecision } from '../data/types'
import { KIND_DOT, KIND_LABEL } from './entity'
import s from './AssetPrecheck.module.css'

// 统一的资产检查区（v2.2 §4.2），四个任务弹窗共用。三种状态：检查中 / 没有新资产 / 发现新资产。
// 「没有新资产」也要显式说——过去零候选是静默续跑，用户根本不知道系统查过（§4.2）。

export interface Decision {
  decision: CandidateDecision
  linkTargetId?: string
}

const DECISION_META: { key: CandidateDecision; label: string; sub: string }[] = [
  { key: 'new', label: '新增到资产库', sub: '创建一条新资产，本次及后续分镜都能用' },
  { key: 'link', label: '使用已有资产', sub: '选一个已有资产替代它' },
  { key: 'skip', label: '本次不入库', sub: '分镜里保留这段文字，但不形成资产引用、不带图片' },
]

/** 把候选按当前 decisions 折叠成最终待结算候选（供弹窗确认时调用）。 */
export function applyDecisions(
  cands: CandidateAsset[],
  decisions: Record<string, Decision>,
): CandidateAsset[] {
  return cands.map((c) => {
    const d = decisions[c.tempId] ?? { decision: 'new' as CandidateDecision }
    return { ...c, decision: d.decision, linkTargetId: d.linkTargetId }
  })
}

export function AssetPrecheck({
  cands, assets, decisions, onChange, applySummary,
}: {
  cands: CandidateAsset[]
  assets: Record<string, Asset>
  decisions: Record<string, Decision>
  onChange: (tempId: string, decision: CandidateDecision, linkTargetId?: string) => void
  applySummary: ReactNode
}) {
  // 打开即自动跑，免费。检查是纯函数、毫秒级，这里只做一个短暂的「查过了」表现（§4.2）。
  const [checking, setChecking] = useState(true)
  useEffect(() => {
    const t = window.setTimeout(() => setChecking(false), 550)
    return () => window.clearTimeout(t)
  }, [])

  if (checking) {
    return (
      <div className={s.box}>
        <div className={s.checking}>
          <span className={s.spin} />
          正在检查本场是否出现尚未收录的角色、服装、场景和道具……
        </div>
      </div>
    )
  }

  if (cands.length === 0) {
    return (
      <div className={s.box}>
        <div className={s.clean}>✓ 未发现尚未收录的资产，将直接使用项目资产库中的现有资产。</div>
      </div>
    )
  }

  const sameKind = (kind: AssetKind) => Object.values(assets).filter((a) => a.kind === kind)

  return (
    <div className={s.box}>
      <div className={s.lead}>
        发现 {cands.length} 项尚未收录的资产。以下资产尚未保存，
        <b>默认会随本次操作加入项目资产库</b>。你可以逐项调整处理方式。
      </div>
      <div className={s.table}>
        <div className={s.thead}>
          <span>新识别内容</span><span>类型</span><span>处理方式</span>
        </div>
        {cands.map((c) => {
          const d = decisions[c.tempId] ?? { decision: 'new' as CandidateDecision }
          const pool = sameKind(c.kind)
          const target = d.linkTargetId ? assets[d.linkTargetId] : undefined
          return (
            <div key={c.tempId} className={s.trow}>
              <div className={s.tName}>
                <i className={s.dot} style={{ background: KIND_DOT[c.kind] }} />
                {c.name}
              </div>
              <div className={s.tKind}>{KIND_LABEL[c.kind]}</div>
              <div className={s.tCtrl}>
                <select
                  className={s.sel}
                  value={d.decision}
                  onChange={(e) => {
                    const dec = e.target.value as CandidateDecision
                    onChange(c.tempId, dec, dec === 'link' ? (d.linkTargetId ?? pool[0]?.id) : undefined)
                  }}
                >
                  {DECISION_META.map((m) => (
                    <option key={m.key} value={m.key} disabled={m.key === 'link' && pool.length === 0}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <div className={s.sub}>{DECISION_META.find((m) => m.key === d.decision)?.sub}</div>
                {d.decision === 'link' && (
                  <>
                    <select
                      className={s.linkSel}
                      value={d.linkTargetId ?? pool[0]?.id ?? ''}
                      onChange={(e) => onChange(c.tempId, 'link', e.target.value)}
                    >
                      {pool.length === 0 && <option value="">（无同类已入库资产）</option>}
                      {pool.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                    {target && (
                      <div className={s.effect}>
                        以后剧本里再出现「{c.name}」，也会按「{target.name}」处理。
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <div className={s.summary}>{applySummary}</div>
    </div>
  )
}
