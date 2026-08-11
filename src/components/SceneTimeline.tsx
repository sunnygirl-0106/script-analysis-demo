import { useMemo } from 'react'
import type { Scene, Shot } from '../data/types'
import { computeTimeline, sceneDuration } from '../services/timeline'
import s from './SceneTimeline.module.css'

function fmt(sec: number): string {
  const m = Math.floor(sec / 60)
  const ss = sec % 60
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

interface Props {
  scene: Scene
  shots: Record<string, Shot>
  activeId: string | null
  onHover: (id: string | null) => void
}

// ★ 时间轴：把本场每个镜按时长画成一条分段进度条 + 时间刻度 + 当前镜读数。
// 对齐《新版ui.html》参考稿顶部时间轴。高亮仅随悬停出现。
export function SceneTimeline({ scene, shots, activeId, onHover }: Props) {
  const total = sceneDuration(scene, shots)
  const timeline = computeTimeline(scene, shots)

  const { ticks, tickLabels } = useMemo(() => {
    const step = total > 90 ? 15 : total > 45 ? 10 : 5
    const tk: { left: string; h: number; major: boolean }[] = []
    const lb: { left: string; tx: string; label: string; end: boolean }[] = []
    for (let t = 0; t <= total; t += 1) {
      const major = t % step === 0 || t === total
      tk.push({ left: `${(t / total) * 100}%`, h: major ? 5 : 3, major })
      const crowded = t !== total && total - t < step * 0.7
      if (major && !crowded) {
        lb.push({
          left: `${(t / total) * 100}%`,
          tx: t === 0 ? '0' : t === total ? '-100%' : '-50%',
          label: fmt(t),
          end: t === total,
        })
      }
    }
    return { ticks: tk, tickLabels: lb }
  }, [total])

  const active = activeId ? timeline.find((e) => e.shotId === activeId) : undefined
  const activeShot = active ? shots[active.shotId] : undefined

  return (
    <div className={s.wrap}>
      <div className={s.head}>
        <b>
          第 {scene.no} 场 {scene.name}
        </b>
        <span className={s.count}>
          {scene.shotIds.length} 镜 · 全场 {fmt(total)}
        </span>
        <span className={[s.readout, active ? s.on : ''].join(' ')}>
          <i className={s.dot} />
          <span className={s.rLabel}>
            {active && activeShot ? `镜 ${String(activeShot.no).padStart(2, '0')}` : '时间线'}
          </span>
          <span className={s.rRange}>
            {active ? `${fmt(active.startAt)} → ${fmt(active.endAt)}` : `00:00 → ${fmt(total)}`}
          </span>
          <span className={s.rDur}>{active && activeShot ? `${activeShot.duration}s` : `${total}s`}</span>
        </span>
      </div>

      <div className={s.bar}>
        {timeline.map((entry, i) => {
          const shot = shots[entry.shotId]
          if (!shot) return null
          const on = activeId === entry.shotId
          return (
            <div
              key={entry.shotId}
              className={[s.seg, on ? s.segOn : i % 2 ? s.segAlt : ''].join(' ')}
              style={{ flex: shot.duration }}
              title={`镜 ${String(shot.no).padStart(2, '0')} · ${fmt(entry.startAt)} → ${fmt(entry.endAt)} · ${shot.duration}s`}
              onMouseEnter={() => onHover(entry.shotId)}
              onMouseLeave={() => onHover(null)}
            >
              {i > 0 && <span className={s.segDiv} />}
            </div>
          )
        })}
      </div>

      <div className={s.ticks}>
        {ticks.map((t, i) => (
          <span
            key={`t${i}`}
            className={[s.tick, t.major ? s.tickMajor : ''].join(' ')}
            style={{ left: t.left, height: t.h }}
          />
        ))}
        {tickLabels.map((t, i) => (
          <span
            key={`l${i}`}
            className={[s.tickLabel, t.end ? s.tickEnd : ''].join(' ')}
            style={{ left: t.left, transform: `translateX(${t.tx})` }}
          >
            {t.label}
          </span>
        ))}
      </div>
    </div>
  )
}
