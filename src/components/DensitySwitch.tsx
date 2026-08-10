import { useStore } from '../store/useStore'
import type { ShotDensity } from '../data/types'
import s from './DensitySwitch.module.css'

const OPTIONS: { key: ShotDensity; label: string }[] = [
  { key: 'compact', label: '紧凑' },
  { key: 'standard', label: '标准' },
  { key: 'loose', label: '舒缓' },
]

// ★ 镜头密度：切换后本场分镜重排，镜数变化，时间轴重算。
export function DensitySwitch({ disabled }: { disabled?: boolean }) {
  const density = useStore((st) => st.project.shotDensity)
  const setDensity = useStore((st) => st.setDensity)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span className={s.label}>镜头密度</span>
      <div className={s.seg}>
        {OPTIONS.map((o) => (
          <button
            key={o.key}
            className={o.key === density ? s.on : ''}
            disabled={disabled}
            onClick={() => setDensity(o.key)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
