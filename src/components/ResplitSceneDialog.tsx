import { useState } from 'react'
import { Dialog } from './Dialog'
import { useStore } from '../store/useStore'
import type { ShotDensity } from '../data/types'
import { densityShots, hasDensityPresets } from '../services/density'
import { costSplit, fmtCost } from '../services/cost'
import { PHASES, taskDuration } from '../services/taskRun'
import { TaskProgress } from './TaskProgress'
import ui from '../styles/ui.module.css'
import d from '../styles/dialog.module.css'
import s from './ResplitSceneDialog.module.css'

type Choice = ShotDensity | 'custom'

const DENSITY_META: { key: ShotDensity; label: string }[] = [
  { key: 'compact', label: '紧凑' },
  { key: 'standard', label: '标准' },
  { key: 'loose', label: '舒缓' },
]

// ★ 重拆本场：节奏设置 + 消耗汇总，一次确认到底。点确认后弹窗原地跑进度，跑完关闭。
// 重拆保留，但**不再提取资产**——资产口径降成估算行下面的一句灰字。
// 重拆是「换一种拆法」，不是「再读一遍剧本」；要补资产请去项目资产库加。
export function ResplitSceneDialog({ sceneId, onClose }: { sceneId: string; onClose: () => void }) {
  const scene = useStore((st) => st.project.scenes[sceneId])
  const runResplitScene = useStore((st) => st.runResplitScene)

  const hasPresets = hasDensityPresets(sceneId)
  const curCount = scene?.shotIds.length ?? 0
  const [choice, setChoice] = useState<Choice>(scene?.density ?? 'standard')
  const [customN, setCustomN] = useState(curCount)
  const [running, setRunning] = useState(false)

  const countOf = (dn: ShotDensity) =>
    hasPresets ? densityShots(sceneId, dn).length : dn === scene?.density ? curCount : 0

  if (!scene) return null

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
    <Dialog onClose={onClose} dismissible={!running} className={s.dialog}>
      <div className={d.title}>重新拆分「第 {scene.no} 场 {scene.name}」</div>

      {running ? (
        <div style={{ marginTop: 16 }}>
          <TaskProgress phases={PHASES.resplitScene} durationMs={taskDuration(cost)} onDone={runDone} />
        </div>
      ) : (
        <>
          <div className={d.desc}>
            本场现有 {curCount} 镜将被替换，已生成的提示词会一并清除。
          </div>

          <div className={[d.seg, s.seg].join(' ')}>
            {DENSITY_META.map((m) => {
              // 没有预设方案的场只能重跑当前档：其余档没有可拆的结果，按了也没有意义。
              const disabled = !hasPresets && scene.density !== m.key
              return (
                <button
                  key={m.key}
                  className={[d.segBtn, choice === m.key ? d.segOn : ''].join(' ')}
                  disabled={disabled}
                  onClick={() => setChoice(m.key)}
                >
                  {m.label}
                </button>
              )
            })}
            <button
              className={[d.segBtn, choice === 'custom' ? d.segOn : ''].join(' ')}
              disabled={!hasPresets}
              onClick={() => setChoice('custom')}
            >
              指定镜头数
            </button>
          </div>

          {choice === 'custom' && (
            <div className={s.customRow}>
              <input
                className={s.countInput}
                type="number"
                min={3}
                max={20}
                value={customN}
                aria-label="期望镜头数"
                onChange={(e) => setCustomN(Math.max(3, Math.min(20, Number(e.target.value) || 3)))}
              />
              <span>镜（3–20），系统会尽量接近这个数量</span>
            </div>
          )}

          <div className={s.est}>预计 {estShots} 镜</div>
          <div className={s.note}>
            使用项目资产库中的现有资产，不新增；本场原有分镜与人工修改不可恢复。
          </div>

          <div className={d.footRow}>
            <span className={d.footNote}>消耗 {fmtCost(cost)}</span>
            <span className={d.footBtns}>
              <button className={ui.btn} onClick={onClose}>取消</button>
              <button className={[ui.btn, ui.btnPrimary].join(' ')} onClick={confirm}>
                重新拆分
              </button>
            </span>
          </div>
        </>
      )}
    </Dialog>
  )
}
