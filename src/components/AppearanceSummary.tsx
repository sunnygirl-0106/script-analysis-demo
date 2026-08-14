import { useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { createPortal } from 'react-dom'
import type { Appearance } from '../data/types'
import { summarizeAppearances } from '../services/appearance'
import { useClickOutside } from '../hooks/useClickOutside'
import s from './AssetList.module.css'

interface Props {
  appearances: Appearance[]
  shotCount: number
  /** 紧凑版：只显示「N 场」，不展开（角色卡片下的服装 chip 行用）。 */
  compact?: boolean
  /** 表格「出场」列版：明细行（集·场，两行截断）+ 数字摘要行，hover title 看完整明细。 */
  column?: boolean
}

// 出场位置：默认给数字摘要，明细按需展开（展开态有高度上限 + 滚动）。
export function AppearanceSummary({ appearances, shotCount, compact, column }: Props) {
  const [open, setOpen] = useState(false)
  const sum = summarizeAppearances(appearances)

  if (column) {
    if (appearances.length === 0) {
      return (
        <span className={s.apprCol}>
          <span className={s.apprColMuted}>未出场</span>
        </span>
      )
    }
    // 数字摘要打头（永远塞得下、最常扫的），场号明细降为次要预览，点击看全部。
    const summary =
      sum.episodeCount === 1
        ? `${sum.sceneCount} 场 · ${shotCount} 镜`
        : `${sum.episodeCount} 集 · ${sum.sceneCount} 场 · ${shotCount} 镜`
    const detail = sum.groups.map((g) => `${g.episodeNo}集 ${g.label}场`).join('，')
    return <AppearanceColumn summary={summary} detail={detail} groups={sum.groups} />
  }

  if (appearances.length === 0) return <span className={s.rt}>未在任何镜头出现</span>
  if (compact) return <span className={s.rt}>{sum.sceneCount} 场</span>

  // 小数据集直接平铺不折叠：集数 ≤ 2 且总场数 ≤ 6。
  if (sum.episodeCount <= 2 && sum.sceneCount <= 6) {
    return (
      <span className={s.rt}>
        {sum.groups.map((g, i) => (
          <span key={g.episodeNo}>
            {i > 0 && ' · '}
            {g.episodeNo}集 {g.label}场
          </span>
        ))}
      </span>
    )
  }

  return (
    <span className={s.apprRow}>
      <span className={s.apprToggle} onClick={() => setOpen((v) => !v)}>
        出场 {sum.episodeCount} 集 · {sum.sceneCount} 场 · {shotCount} 个镜头 {open ? '▾' : '▸'}
      </span>
      {open && (
        <span className={s.apprDetail}>
          {sum.groups.map((g) => (
            <span className={s.apprLine} key={g.episodeNo}>
              <b>第 {g.episodeNo} 集</b>
              <span>{g.label} 场</span>
            </span>
          ))}
        </span>
      )}
    </span>
  )
}

// 表格「出场」列：数字摘要 + 一行明细预览；点击弹出完整逐集明细（可滚动），
// 应对「很多很多场」——单元格永远紧凑，全部内容一键可查。
function AppearanceColumn({
  summary, detail, groups,
}: {
  summary: string
  detail: string
  groups: { episodeNo: number; label: string }[]
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const popRef = useRef<HTMLDivElement>(null)
  useClickOutside(popRef, () => setPos(null), pos !== null)

  const toggle = (e: ReactMouseEvent) => {
    e.stopPropagation()
    if (pos) return setPos(null)
    const r = e.currentTarget.getBoundingClientRect()
    const w = 240
    const pad = 8
    setPos({ x: Math.min(r.left, window.innerWidth - w - pad), y: r.bottom + 4 })
  }

  return (
    <>
      <button type="button" className={s.apprCol} onClick={toggle} title="点击查看全部出场">
        <span className={s.apprColSum}>{summary}</span>
        <span className={s.apprColDetail}>{detail}</span>
      </button>
      {pos &&
        createPortal(
          <div className={s.apprPop} ref={popRef} style={{ left: pos.x, top: pos.y }}>
            <div className={s.apprPopHead}>出场明细 · 共 {groups.length} 集</div>
            <div className={s.apprPopBody}>
              {groups.map((g) => (
                <div className={s.apprPopRow} key={g.episodeNo}>
                  <b>第 {g.episodeNo} 集</b>
                  <span>{g.label} 场</span>
                </div>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
