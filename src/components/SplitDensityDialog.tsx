import { useState } from 'react'
import { useStore } from '../store/useStore'
import type { ShotDensity } from '../data/types'
import type { Decision } from './decision'
import { DENSITY_META } from '../services/density'
import { EST, costSplitByWords, estimateScenes, estimateShotRange, fmtCost } from '../services/cost'
import ui from '../styles/ui.module.css'
import d from '../styles/dialog.module.css'
import s from './SplitDensityDialog.module.css'

// 节奏弹窗（v2.5 §6.2）。v2.4 把三张节奏卡做成了步骤③ 的起点页，本轮推翻——
// 选节奏是「确认资产并开始拆分」这一个动作里的一个参数，它属于弹窗，不值得一整页。
//
// 镜数是**生成前**的估算，所以三张卡与摘要一律给区间；价格按字数 × 档位系数算，是确定值。
// 把解释这件事的那行琥珀色小字删了——区间本身已经在说「这是估的」。
export function SplitDensityDialog({
  decisions, onClose,
}: {
  /** 已入库的增量场景要把候选处理方式一并带走；首次拆分传 undefined。 */
  decisions?: Record<string, Decision>
  onClose: () => void
}) {
  const project = useStore((st) => st.project)
  const beginSplit = useStore((st) => st.beginSplit)
  const [density, setDensity] = useState<ShotDensity>(project.defaultDensity)

  const incremental = project.libraryCommittedAt != null
  // 本次要拆的集：已提取资产、还没有场的那些。
  const targets = project.episodes.filter((e) => e.extractedAt && e.sceneIds.length === 0)
  const words = targets.reduce((n, e) => n + e.wordCount, 0)
  const scenes = estimateScenes(words)
  const rangeOf = (dn: ShotDensity) => estimateShotRange(words, dn)
  const costOf = (dn: ShotDensity) => costSplitByWords(words, dn)

  const [lo, hi] = rangeOf(density)
  const cost = costOf(density)
  const label = DENSITY_META.find((m) => m.key === density)?.label ?? ''
  const scope = incremental
    ? `第 ${targets.map((e) => e.no).join(' / ') || '新'} 集`
    : `全剧 ${targets.length} 集`

  return (
    <div className={d.overlay} onClick={onClose}>
      <div className={s.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={s.head}>
          <div className={d.title}>{incremental ? '确认新增资产并开始拆分' : '确认资产并开始拆分'}</div>
          <button className={s.close} onClick={onClose} title="关闭" aria-label="关闭">×</button>
        </div>
        <div className={s.sub}>
          {scope} · 预计约 {scenes} 场。
        </div>

        <div className={s.secTitle}>选择全剧默认镜头节奏</div>
        <div className={s.cards}>
          {DENSITY_META.map((m) => {
            const on = density === m.key
            const [l, h] = rangeOf(m.key)
            return (
              <button
                key={m.key}
                className={[s.card, on ? s.cardOn : ''].join(' ')}
                onClick={() => setDensity(m.key)}
              >
                <div className={s.cardHead}>
                  <span className={s.cardName}>{m.label}</span>
                  {m.key === 'standard' && <span className={s.rec}>推荐</span>}
                </div>
                <div className={s.cardDesc}>{m.desc}</div>
                <div className={s.bars}>
                  <span className={s.barsLabel}>
                    镜头量{m.bars === 3 ? '较多' : m.bars === 2 ? '适中' : '较少'}
                  </span>
                  {[0, 1, 2].map((i) => (
                    <span key={i} className={[s.bar, i < m.bars ? s.barOn : ''].join(' ')} />
                  ))}
                </div>
                <div className={s.cardSec}>约 {EST.secPerShot[m.key]} 秒 / 镜</div>
                <div className={s.cardEst}>
                  预计约 {l}–{h} 镜 · <b>{fmtCost(costOf(m.key))}</b>
                </div>
              </button>
            )
          })}
        </div>

        <div className={s.summary}>
          <div className={s.summaryTop}>
            <span className={s.summaryTitle}>已选{label}节奏</span>
            <span className={s.summaryVal}>预计 {lo}–{hi} 镜 · {fmtCost(cost)}</span>
          </div>
        </div>

        <div className={d.actions}>
          <button className={ui.btn} onClick={onClose}>取消</button>
          <button
            className={[ui.btn, ui.btnPrimary].join(' ')}
            onClick={() => { onClose(); beginSplit(density, decisions) }}
          >
            确认并开始拆分 · {fmtCost(cost)}
          </button>
        </div>
      </div>
    </div>
  )
}
