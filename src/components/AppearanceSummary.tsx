import { useState } from 'react'
import type { Appearance } from '../data/types'
import { summarizeAppearances } from '../services/appearance'
import s from './AssetList.module.css'

interface Props {
  appearances: Appearance[]
  shotCount: number
  /** 紧凑版：只显示「N 场」，不展开（角色卡片下的服装 chip 行用）。 */
  compact?: boolean
}

// 出场位置：默认给数字摘要，明细按需展开（展开态有高度上限 + 滚动）。
export function AppearanceSummary({ appearances, shotCount, compact }: Props) {
  const [open, setOpen] = useState(false)
  const sum = summarizeAppearances(appearances)

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
