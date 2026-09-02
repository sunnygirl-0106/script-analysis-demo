import { useMemo, useState } from 'react'
import { Dialog } from './Dialog'
import { useStore } from '../store/useStore'
import type { ShotDensity } from '../data/types'
import { sceneDuration } from '../services/timeline'
import { costSplit, fmtCost } from '../services/cost'
import { PHASES, taskDuration } from '../services/taskRun'
import { TaskProgress } from './TaskProgress'
import ui from '../styles/ui.module.css'
import d from '../styles/dialog.module.css'
import s from './ResplitEpisodeDialog.module.css'

const DENSITY: { key: ShotDensity; label: string }[] = [
  { key: 'compact', label: '紧凑' },
  { key: 'standard', label: '标准' },
  { key: 'loose', label: '舒缓' },
]

// ★ 重拆本集：设置 + 消耗，一次确认，弹窗内跑进度。
// 重拆不再提取资产，资产检查区换成一行静态灰字（同重拆本场）。
export function ResplitEpisodeDialog({ episodeId, onClose }: { episodeId: string; onClose: () => void }) {
  const project = useStore((st) => st.project)
  const runResplitEpisode = useStore((st) => st.runResplitEpisode)

  const ep = project.episodes.find((e) => e.id === episodeId)
  const [density, setDensity] = useState<ShotDensity>('standard')
  const [sceneMode, setSceneMode] = useState<'auto' | 'custom'>('auto')
  const [running, setRunning] = useState(false)

  const stats = useMemo(() => {
    if (!ep) return { scenes: 0, shots: 0, dur: 0, sceneIds: [] as string[] }
    const sceneIds = ep.sceneIds.filter((id) => project.scenes[id])
    const scenes = sceneIds.map((id) => project.scenes[id]!)
    const shots = scenes.reduce((n, sc) => n + sc.shotIds.length, 0)
    const dur = scenes.reduce((n, sc) => n + sceneDuration(sc, project.shots), 0)
    return { scenes: scenes.length, shots, dur, sceneIds }
  }, [ep, project])

  const [customScenes, setCustomScenes] = useState(stats.scenes)
  const cost = costSplit(stats.sceneIds, density)

  if (!ep) return null

  const confirm = () => setRunning(true)
  const runDone = () => {
    runResplitEpisode(episodeId, { density, sceneCount: sceneMode === 'custom' ? customScenes : undefined })
    onClose()
  }

  return (
    <Dialog
      onClose={onClose}
      dismissible={!running}
      className={d.dialog}
    >
      <div className={d.title}>重新拆分第 {ep.no} 集 · {ep.title}</div>

      {running ? (
        <div style={{ marginTop: 8 }}>
          <TaskProgress phases={PHASES.resplitEp} durationMs={taskDuration(cost)} onDone={runDone} />
        </div>
      ) : (
        <>
          <div className={s.sub}>当前：{stats.scenes} 场 · {stats.shots} 镜 · 约 {stats.dur} 秒</div>

          <div className={s.groupTitle}>场景划分</div>
          <div className={s.sceneOpts}>
            <label className={[s.opt, sceneMode === 'auto' ? s.optOn : ''].join(' ')}>
              <input type="radio" checked={sceneMode === 'auto'} onChange={() => setSceneMode('auto')} />
              由 AI 自动划分（当前 {stats.scenes} 场）
            </label>
            <label className={[s.opt, sceneMode === 'custom' ? s.optOn : ''].join(' ')}>
              <input type="radio" checked={sceneMode === 'custom'} onChange={() => setSceneMode('custom')} />
              指定
              <input
                className={s.countInput}
                type="number"
                min={1}
                max={30}
                value={customScenes}
                disabled={sceneMode !== 'custom'}
                onChange={(e) => setCustomScenes(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
              />
              场
            </label>
            {sceneMode === 'custom' && <div className={s.sceneNote}>当前版本暂不支持调整场景数量。</div>}
          </div>

          <div className={s.groupTitle}>默认镜头节奏</div>
          <div className={s.seg}>
            {DENSITY.map((o) => (
              <button key={o.key} className={o.key === density ? s.segOn : ''} onClick={() => setDensity(o.key)}>
                {o.label}
              </button>
            ))}
          </div>

          <div className={s.assetNote}>
            ✓ 本次将使用项目资产库中的现有资产，不新增。如需补充请到项目资产库添加。
          </div>

          <div className={s.impact}>
            <div className={s.impactTitle}>预计消耗</div>
            预计生成约 {cost} 个镜头 · 预计消耗 {fmtCost(cost)}。本集原有分镜、人工修改和镜头提示词将被新结果替换；此操作不可撤销。
          </div>

          <div className={d.actions}>
            <button className={ui.btn} onClick={onClose}>取消</button>
            <button className={[ui.btn, ui.btnPrimary].join(' ')} onClick={confirm}>
              确认并重新拆分本集 · {fmtCost(cost)}
            </button>
          </div>
        </>
      )}
    </Dialog>
  )
}
