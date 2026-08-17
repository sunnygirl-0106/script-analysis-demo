import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import type { ShotDensity } from '../data/types'
import { densityShots, hasDensityPresets } from '../services/density'
import { isLongShot } from '../services/duration'
import { sceneDuration } from '../services/timeline'
import ui from '../styles/ui.module.css'
import d from './ScriptImportDialog.module.css'
import s from './ResplitSceneDialog.module.css'

type Choice = ShotDensity | 'custom'

const DENSITY_META: { key: ShotDensity; label: string; hint: string }[] = [
  { key: 'compact', label: '紧凑', hint: '镜头更多，节奏更快' },
  { key: 'standard', label: '标准', hint: '镜头数量与节奏较均衡' },
  { key: 'loose', label: '舒缓', hint: '镜头更长，节奏更慢' },
]

// ★ 重拆本场：把「密度切换」收敛进来，颗粒度作为参数。镜数全部真实算出。
export function ResplitSceneDialog({ sceneId, onClose }: { sceneId: string; onClose: () => void }) {
  const scene = useStore((st) => st.project.scenes[sceneId])
  const shots = useStore((st) => st.project.shots)
  const resplit = useStore((st) => st.resplit)

  const hasPresets = hasDensityPresets(sceneId)
  const curCount = scene?.shotIds.length ?? 0
  const [choice, setChoice] = useState<Choice>(scene?.density ?? 'standard')
  const [customN, setCustomN] = useState(curCount)

  // 每套方案的真实镜数（无预设时只有当前颗粒度这一档有意义）。
  const countOf = (dn: ShotDensity) =>
    hasPresets ? densityShots(sceneId, dn).length : dn === scene?.density ? curCount : 0

  // 选中方案的长镜数量（自定义镜数按最接近的一套预览）。
  const longCount = useMemo(() => {
    if (!hasPresets) return 0
    let dn: ShotDensity
    if (choice === 'custom') {
      const cands: ShotDensity[] = ['compact', 'standard', 'loose']
      dn = cands.reduce((best, c) =>
        Math.abs(densityShots(sceneId, c).length - customN) <
        Math.abs(densityShots(sceneId, best).length - customN)
          ? c
          : best,
      )
    } else {
      dn = choice
    }
    return densityShots(sceneId, dn).filter((sh) => isLongShot(sh.duration)).length
  }, [choice, customN, hasPresets, sceneId])

  if (!scene) return null
  const total = sceneDuration(scene, shots)

  const confirm = () => {
    if (!hasPresets) resplit(sceneId, {})
    else if (choice === 'custom') resplit(sceneId, { targetShots: customN })
    else resplit(sceneId, { density: choice })
    onClose()
  }

  return (
    <div className={d.overlay} onClick={onClose}>
      <div className={d.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={d.title}>
          重新拆分第 {scene.no} 场 · {scene.name}
        </div>
        <div className={s.sub}>
          当前为 {curCount} 个镜头，共 {total} 秒
        </div>

        <div className={s.groupTitle}>镜头节奏</div>
        <div className={s.opts}>
          {DENSITY_META.map((m) => {
            const on = choice === m.key
            const isCurrent = scene.density === m.key
            const disabled = !hasPresets && !isCurrent
            return (
              <label
                key={m.key}
                className={[s.opt, on ? s.optOn : '', disabled ? s.optDisabled : ''].join(' ')}
              >
                <input
                  type="radio"
                  checked={on}
                  disabled={disabled}
                  onChange={() => setChoice(m.key)}
                />
                <span className={s.optLabel}>{m.label}</span>
                <span className={s.optCount}>{countOf(m.key)} 镜</span>
                <span className={s.optHint}>
                  {isCurrent ? '当前方案' : m.hint}
                  {isCurrent && <span className={s.badge}>当前</span>}
                </span>
              </label>
            )
          })}

          <label className={[s.opt, choice === 'custom' ? s.optOn : '', !hasPresets ? s.optDisabled : ''].join(' ')}>
            <input
              type="radio"
              checked={choice === 'custom'}
              disabled={!hasPresets}
              onChange={() => setChoice('custom')}
            />
            <span className={s.optLabel}>期望镜头数</span>
            <span className={s.optCount}>
              <input
                className={s.countInput}
                type="number"
                min={3}
                max={20}
                value={customN}
                disabled={choice !== 'custom'}
                onChange={(e) => setCustomN(Math.max(3, Math.min(20, Number(e.target.value) || 3)))}
              />
              镜
            </span>
            <span className={s.optHint}>系统会尽量接近这个数量</span>
          </label>
        </div>

        {longCount > 0 && (
          <div className={s.warn}>
            ⚠ 其中 {longCount} 个镜头时长较长，生成视频时可能需要拆成多段。
          </div>
        )}

        <div className={s.impact}>
          <div className={s.impactTitle}>重新拆分后</div>
          重新拆分后，本场的镜头和提示词将重新生成。已有角色造型、场景和道具会保留，其他场景不会改变。手动修改过的本场分镜将被替换。
        </div>

        <div className={d.actions}>
          <button className={ui.btn} onClick={onClose}>
            取消
          </button>
          <button className={[ui.btn, ui.btnPrimary].join(' ')} onClick={confirm}>
            确认重新拆分
          </button>
        </div>
      </div>
    </div>
  )
}
