import { useEffect, useRef, useState } from 'react'
import type { Phase } from '../services/taskRun'

/** 阶段时间线：按 weight 把 durationMs 分给每个阶段，跑完调 onDone。
 *  两个消费者共用它 —— 弹窗里的 TaskProgress（阶段列表）与整页的 FullPageProcess（单行大字）。
 *  时间线只在挂载时排一次：phases / durationMs 对一次任务而言是固定值。 */
export interface Timeline {
  /** 正在跑的阶段下标；等于 phases.length 表示全部完成。 */
  idx: number
  done: boolean
  /** 进度条宽度百分比（含当前阶段的累计占比）。 */
  barPct: number
  /** 进度条过渡时长 = 当前阶段时长，于是条子在阶段内平滑爬过去。 */
  barMs: number
  /** 当前阶段文案；全部完成后为 undefined。 */
  label: string | undefined
}

export function useTaskTimeline(phases: Phase[], durationMs: number, onDone?: () => void): Timeline {
  const total = phases.reduce((sum, p) => sum + p.weight, 0)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const done = idx >= phases.length
  const cum = phases.slice(0, idx + 1).reduce((sum, p) => sum + p.weight, 0)
  return {
    idx,
    done,
    barPct: done ? 100 : (cum / total) * 100,
    barMs: done ? 0 : (durationMs * (phases[idx]?.weight ?? 0)) / total,
    label: phases[idx]?.label,
  }
}
