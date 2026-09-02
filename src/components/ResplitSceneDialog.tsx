import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import type { ShotDensity } from '../data/types'
import { densityShots, hasDensityPresets } from '../services/density'
import { isLongShot } from '../services/duration'
import { sceneDuration } from '../services/timeline'
import { costSplit, fmtCost } from '../services/cost'
import { PHASES, taskDuration } from '../services/taskRun'
import { TaskProgress } from './TaskProgress'
import ui from '../styles/ui.module.css'
import d from '../styles/dialog.module.css'
import s from './ResplitSceneDialog.module.css'

type Choice = ShotDensity | 'custom'

const DENSITY_META: { key: ShotDensity; label: string; hint: string }[] = [
  { key: 'compact', label: '紧凑', hint: '镜头更多，节奏更快' },
  { key: 'standard', label: '标准', hint: '镜头数量与节奏较均衡' },
  { key: 'loose', label: '舒缓', hint: '镜头更长，节奏更慢' },
]

// ★ 重拆本场：节奏设置 + 消耗汇总，一次确认到底。点确认后弹窗原地跑进度，跑完关闭。
// 重拆保留，但**不再提取资产**——资产检查区换成一行静态灰字。
// 重拆是「换一种拆法」，不是「再读一遍剧本」；要补资产请去项目资产库加。
export function ResplitSceneDialog({ sceneId, onClose }: { sceneId: string; onClose: () => void }) {
  const scene = useStore((st) => st.project.scenes[sceneId])
  const shots = useStore((st) => st.project.shots)
  const runResplitScene = useStore((st) => st.runResplitScene)

  const hasPresets = hasDensityPresets(sceneId)
  const curCount = scene?.shotIds.length ?? 0
  const [choice, setChoice] = useState<Choice>(scene?.density ?? 'standard')
  const [customN, setCustomN] = useState(curCount)
  const [running, setRunning] = useState(false)

  const countOf = (dn: ShotDensity) =>
    hasPresets ? densityShots(sceneId, dn).length : dn === scene?.density ? curCount : 0

  const longCount = useMemo(() => {
    if (!hasPresets) return 0
    let dn: ShotDensity
    if (choice === 'custom') {
      const list: ShotDensity[] = ['compact', 'standard', 'loose']
      dn = list.reduce((best, c) =>
        Math.abs(densityShots(sceneId, c).length - customN) <
        Math.abs(densityShots(sceneId, best).length - customN) ? c : best,
      )
    } else dn = choice
    return densityShots(sceneId, dn).filter((sh) => isLongShot(sh.duration)).length
  }, [choice, customN, hasPresets, sceneId])

  if (!scene) return null
  const total = sceneDuration(scene, shots)

  const density: ShotDensity = choice === 'custom' ? 'standard' : choice
  const estShots = choice === 'custom' ? customN : countOf(density) || curCount
  const cost = choice === 'custom' ? customN : costSplit([sceneId], density)

  const confirm = () => setRunning(true)
  const runDone = () => {
    if (!hasPresets) runResplitScene(sceneId, {})
    else if (choice === 'custom') runResplitScene(sceneId, { targetShots: customN })
    else runResplitScene(sceneId, { density: choice })
    onClose()
  }

  return (
    <div className={d.overlay} onClick={running ? undefined : onClose}>
      <div className={d.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={d.title}>重新拆分第 {scene.no} 场 · {scene.name}</div>

        {running ? (
          <div style={{ marginTop: 8 }}>
            <TaskProgress phases={PHASES.resplitScene} durationMs={taskDuration(cost)} onDone={runDone} />
          </div>
        ) : (
          <>
            <div className={s.sub}>当前为 {curCount} 个镜头，共 {total} 秒</div>

            <div className={s.groupTitle}>镜头节奏</div>
            <div className={s.opts}>
              {DENSITY_META.map((m) => {
                const on = choice === m.key
                const isCurrent = scene.density === m.key
                const disabled = !hasPresets && !isCurrent
                return (
                  <label key={m.key} className={[s.opt, on ? s.optOn : '', disabled ? s.optDisabled : ''].join(' ')}>
                    <input type="radio" checked={on} disabled={disabled} onChange={() => setChoice(m.key)} />
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
                <input type="radio" checked={choice === 'custom'} disabled={!hasPresets} onChange={() => setChoice('custom')} />
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
              <div className={s.warn}>⚠ 其中 {longCount} 个镜头时长较长，生成视频时可能需要拆成多段。</div>
            )}

            <div className={s.assetNote}>
              ✓ 本次将使用项目资产库中的现有资产，不新增。如需补充请到项目资产库添加。
            </div>

            <div className={s.impact}>
              <div className={s.impactTitle}>预计消耗</div>
              预计生成 {estShots} 个镜头 · 预计消耗 {fmtCost(cost)}。本场原有分镜、人工修改和镜头提示词将被新结果替换；此操作不可撤销。
            </div>

            <div className={d.actions}>
              <button className={ui.btn} onClick={onClose}>取消</button>
              <button className={[ui.btn, ui.btnPrimary].join(' ')} onClick={confirm}>
                确认并重新拆分 · {fmtCost(cost)}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
