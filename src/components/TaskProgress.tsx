// 统一 loading 表现件。一列阶段：已完成打 ✓ 变灰，当前项转圈 + 文字高亮，未开始压到 30% 透明度；
// 底下一条细进度条按 weight 推进。不显示百分比数字（假精度），只显示阶段。
// compact 变体：只留一个转圈 + 当前阶段文字，供行内提示词补全用。
//
// 时间线本身在 useTaskTimeline 里，与整页动效 FullPageProcess 共用一份（v2.5 §4.1）。
import { useTaskTimeline } from '../hooks/useTaskTimeline'
import type { Phase } from '../services/taskRun'
import s from './TaskProgress.module.css'
import { ic } from './icons'

interface Props {
  phases: Phase[]
  durationMs: number
  onDone?: () => void
  compact?: boolean
}

export function TaskProgress({ phases, durationMs, onDone, compact }: Props) {
  const { idx, done, barPct, barMs, label } = useTaskTimeline(phases, durationMs, onDone)

  if (compact) {
    return (
      <span className={s.compact} role="status" aria-live="polite">
        <span className={s.spinner} aria-hidden />
        <span className={s.compactLabel}>{done ? '完成' : label}…</span>
      </span>
    )
  }

  return (
    <div className={s.wrap} role="status" aria-live="polite">
      <ul className={s.list}>
        {phases.map((p, i) => {
          const state = i < idx || done ? 'done' : i === idx ? 'active' : 'pending'
          return (
            <li key={i} className={`${s.item} ${s[state]}`}>
              <span className={s.mark} aria-hidden>
                {state === 'done' ? ic.check : state === 'active' ? <span className={s.spinner} /> : null}
              </span>
              <span className={s.label}>{p.label}</span>
            </li>
          )
        })}
      </ul>
      <div className={s.track}>
        <div className={s.fill} style={{ width: `${barPct}%`, transitionDuration: `${barMs}ms` }} />
      </div>
    </div>
  )
}
