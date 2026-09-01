import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import type { AssetKind, ShotDensity } from '../data/types'
import { KIND_LABEL } from './entity'
import { estimateShots, costSplit, fmtCost } from '../services/cost'
import { PHASES, taskDuration } from '../services/taskRun'
import { TaskProgress } from './TaskProgress'
import ui from '../styles/ui.module.css'
import d from './ScriptImportDialog.module.css'
import s from './ResplitSceneDialog.module.css'

// 首次「确认资产并开始拆分」（v2.2 统一弹窗 §4.4①）。
// 资产检查区不用跑——阶段② 整页本身就是那份检查结果，这里只展示汇总。
// 一次确认，系统内部两步：先把候选写进项目资产库，再拆分。点确认后弹窗原地跑进度，跑完关闭。
const DENSITY_META: { key: ShotDensity; label: string; hint: string }[] = [
  { key: 'compact', label: '紧凑', hint: '镜头更多，节奏更快' },
  { key: 'standard', label: '标准', hint: '镜头数量与节奏较均衡' },
  { key: 'loose', label: '舒缓', hint: '镜头更长，节奏更慢' },
]

const KINDS: AssetKind[] = ['character', 'costume', 'location', 'prop']

export function StartSplitDialog({ onClose }: { onClose: () => void }) {
  const project = useStore((st) => st.project)
  const candidates = useStore((st) => st.candidates)
  const startSplit = useStore((st) => st.startSplit)
  const commitLibrary = useStore((st) => st.commitLibrary)
  const [density, setDensity] = useState<ShotDensity>(project.defaultDensity)
  const [running, setRunning] = useState(false)

  const sceneIds = useMemo(() => project.episodes.flatMap((e) => e.sceneIds), [project.episodes])
  const estShotsOf = (dn: ShotDensity) => estimateShots(sceneIds, dn)

  const estShots = estShotsOf(density)
  const cost = costSplit(sceneIds, density)
  const estSec = estShots * 2
  const estTime = estSec >= 60 ? `约 ${Math.ceil(estSec / 60)} 分钟` : `约 ${estSec} 秒`
  const sceneCount = sceneIds.length
  const epCount = project.episodes.length

  // 本次将入库的资产分类计数（decision==='new' 的候选）。
  const newCands = candidates.filter((c) => c.decision === 'new')
  const byKind = KINDS.map((k) => ({ k, n: newCands.filter((c) => c.kind === k).length }))
  const totalNew = newCands.length

  const confirm = () => setRunning(true)
  const runDone = () => {
    // 一次确认，系统内部两步：先入库、再拆分（§3.5 / §4.4①）。
    commitLibrary()
    startSplit({ density })
    onClose()
  }

  return (
    <div className={d.overlay} onClick={running ? undefined : onClose}>
      <div className={d.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={d.title}>确认资产并开始拆分</div>

        {running ? (
          <div style={{ marginTop: 8 }}>
            <TaskProgress phases={PHASES.split} durationMs={taskDuration(cost)} onDone={runDone} />
          </div>
        ) : (
          <>
            <div className={s.sub}>范围：全剧 {epCount} 集 · {sceneCount} 场。本次仅生成分镜，暂不生成提示词。</div>

            <div className={s.groupTitle}>镜头节奏</div>
            <div className={s.opts}>
              {DENSITY_META.map((m) => {
                const on = density === m.key
                return (
                  <label key={m.key} className={[s.opt, on ? s.optOn : ''].join(' ')}>
                    <input type="radio" checked={on} onChange={() => setDensity(m.key)} />
                    <span className={s.optLabel}>{m.label}</span>
                    <span className={s.optCount}>{estShotsOf(m.key)} 镜</span>
                    <span className={s.optHint}>{m.hint}</span>
                  </label>
                )
              })}
            </div>

            <div className={s.impact}>
              <div className={s.impactTitle}>资产检查</div>
              本次将新增 {totalNew} 项资产到项目资产库：
              {byKind.map(({ k, n }, i) => (
                <span key={k}>{i > 0 ? ' · ' : ''}{KIND_LABEL[k]} {n}</span>
              ))}
              。已有资产及图片不会被覆盖。
            </div>

            <div className={s.impact}>
              <div className={s.impactTitle}>预计消耗</div>
              预计生成 {estShots} 个镜头 · 预计消耗 {fmtCost(cost)} · 预计耗时 {estTime}。
              <br />
              本次生成集 / 场 / 镜及分镜脚本，暂不生成最终提示词。
              <br />
              已有资产及图片不会被覆盖，其他场不受影响。
            </div>

            <div className={d.actions}>
              <button className={ui.btn} onClick={onClose}>取消</button>
              <button className={[ui.btn, ui.btnPrimary].join(' ')} onClick={confirm}>
                确认并开始拆分 · {fmtCost(cost)}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
