import type { MouseEvent } from 'react'
import { useStore } from '../store/useStore'
import s from './DurationInput.module.css'

interface Props {
  shotId: string
  duration: number
  why?: string
  readOnly?: boolean
}

// 时长输入，带顺移提示。−/+ 改时长会触发后续镜顺移与 Toast（逻辑在 store 里）。
export function DurationInput({ shotId, duration, why, readOnly }: Props) {
  const setDuration = useStore((st) => st.setShotDuration)

  const step = (e: MouseEvent, delta: number) => {
    e.stopPropagation()
    setDuration(shotId, duration + delta)
  }

  return (
    <div>
      <span className={[s.dur, readOnly ? s.ro : ''].join(' ')}>
        {!readOnly && (
          <button className={s.step} onClick={(e) => step(e, -1)} title="−1s">
            −
          </button>
        )}
        {duration}
        <b>s</b>
        {!readOnly && (
          <button className={s.step} onClick={(e) => step(e, 1)} title="+1s">
            +
          </button>
        )}
      </span>
      {why && <div className={s.why}>{why}</div>}
    </div>
  )
}
