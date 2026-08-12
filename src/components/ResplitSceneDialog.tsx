import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import type { MountableKind, ShotDensity } from '../data/types'
import { densityShots, hasDensityPresets } from '../services/density'
import { isLongShot } from '../services/duration'
import { sceneDuration } from '../services/timeline'
import ui from '../styles/ui.module.css'
import d from './ScriptImportDialog.module.css'
import s from './ResplitSceneDialog.module.css'

type Choice = ShotDensity | 'custom'

const DENSITY_META: { key: ShotDensity; label: string; hint: string }[] = [
  { key: 'compact', label: '紧凑', hint: '切分更细、节奏更快' },
  { key: 'standard', label: '标准', hint: '' },
  { key: 'loose', label: '舒缓', hint: '长镜头更多' },
]

// ★ 重拆本场：把「密度切换」收敛进来，颗粒度作为参数。镜数全部真实算出。
export function ResplitSceneDialog({ sceneId, onClose }: { sceneId: string; onClose: () => void }) {
  const scene = useStore((st) => st.project.scenes[sceneId])
  const shots = useStore((st) => st.project.shots)
  const sceneTotal = useStore((st) => Object.keys(st.project.scenes).length)
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

  // 影响说明里的资产数：本场当前镜里挂过的资产，按类去重。
  const assetCounts = useMemo(() => {
    const buckets: Record<MountableKind, Set<string>> = {
      look: new Set(),
      character: new Set(),
      location: new Set(),
      prop: new Set(),
    }
    for (const id of scene?.shotIds ?? []) {
      const sh = shots[id]
      if (!sh) continue
      for (const m of sh.mounts) buckets[m.kind].add(m.assetId)
    }
    return {
      look: buckets.look.size,
      location: buckets.location.size,
      prop: buckets.prop.size,
    }
  }, [scene, shots])

  if (!scene) return null
  const total = sceneDuration(scene, shots)
  const otherScenes = sceneTotal - 1

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
          重拆第 {scene.no} 场 · {scene.name}
        </div>
        <div className={s.sub}>
          当前拆解：{curCount} 镜 · {total} 秒
        </div>

        {!hasPresets && (
          <div className={s.presetNote}>
            演示数据仅为第 1 场准备了多套拆解方案；本场重拆将按原方案重新生成，镜数不变。
          </div>
        )}

        <div className={s.groupTitle}>拆解颗粒度</div>
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
            <span className={s.optLabel}>指定镜数</span>
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
            <span className={s.optHint}>3–20，取最接近的一套</span>
          </label>
        </div>

        {longCount > 0 && (
          <div className={s.warn}>
            ⚠ 该方案包含 {longCount} 个较长镜头，后续可能需要分段生成。
          </div>
        )}

        <div className={s.impact}>
          <div className={s.impactTitle}>影响说明</div>
          重拆后，本场的镜头及其画面 / 视频提示词将重新生成；已识别的 {assetCounts.look} 着装角色 /{' '}
          {assetCounts.location} 场景 / {assetCounts.prop} 道具继续保留
          {otherScenes > 0 ? `，其他 ${otherScenes} 场不受影响` : ''}。你对本场分镜的手动修改将被替换。
        </div>

        <div className={d.actions}>
          <button className={ui.btn} onClick={onClose}>
            取消
          </button>
          <button className={[ui.btn, ui.btnPrimary].join(' ')} onClick={confirm}>
            确认重拆
          </button>
        </div>
      </div>
    </div>
  )
}
