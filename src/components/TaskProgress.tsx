// 统一 loading 表现件。一列阶段：已完成打 ✓ 变灰，当前项转圈 + 文字高亮，未开始压到 30% 透明度；
// 底下一条细进度条按 weight 推进。不显示百分比数字（假精度），只显示阶段。
// compact 变体：只留一个转圈 + 当前阶段文字，供行内提示词补全用。
import { useEffect, useRef, useState } from 'react'
import type { Phase } from '../services/taskRun'
import s from './TaskProgress.module.css'

interface Props {
  phases: Phase[]
  durationMs: number
  onDone?: () => void
  compact?: boolean
}

export function TaskProgress({ phases, durationMs, onDone, compact }: Props) {
  const total = phases.reduce((sum, p) => sum + p.weight, 0)
  // idx = 正在跑的阶段下标；跑到 phases.length 表示全部完成。
  const [idx, setIdx] = useState(0)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    const timers: number[] = []
    let acc = 0
    phases.forEach((p, i) => {
      acc += (durationMs * p.weight) / total
      timers.push(
        window.setTimeout(() => {
          if (i + 1 < phases.length) setIdx(i + 1)
          else {
            setIdx(phases.length)
            onDoneRef.current?.()
          }
        }, acc),
      )
    })
    return () => timers.forEach((t) => clearTimeout(t))
    // 只在挂载时排一次时间线；phases / durationMs 每次挂载都是新任务的固定值。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 进度条：跑到第 idx 阶段时，把宽度推到「含该阶段」的累计占比，
  // 过渡时长 = 该阶段时长，于是条子在阶段内平滑爬过去。
  const done = idx >= phases.length
  const cum = phases.slice(0, idx + 1).reduce((sum, p) => sum + p.weight, 0)
  const barPct = done ? 100 : (cum / total) * 100
  const barMs = done ? 0 : (durationMs * (phases[idx]?.weight ?? 0)) / total

  if (compact) {
    const label = done ? '完成' : phases[idx]?.label
    return (
      <span className={s.compact} role="status" aria-live="polite">
        <span className={s.spinner} aria-hidden />
        <span className={s.compactLabel}>{label}…</span>
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
                {state === 'done' ? '✓' : state === 'active' ? <span className={s.spinner} /> : ''}
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
