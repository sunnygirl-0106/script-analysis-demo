import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import type { ShotDensity } from '../data/types'
import { sceneDuration } from '../services/timeline'
import ui from '../styles/ui.module.css'
import d from './ScriptImportDialog.module.css'
import s from './ResplitEpisodeDialog.module.css'

const DENSITY: { key: ShotDensity; label: string }[] = [
  { key: 'compact', label: '紧凑' },
  { key: 'standard', label: '标准' },
  { key: 'loose', label: '舒缓' },
]

// ★ 重拆本集：对本集每个有预设的场应用所选颗粒度，无预设的场恢复初始。
// 演示降级：真的重新划分场数做不到，指定场数只作声明、如实告知不生效。
export function ResplitEpisodeDialog({ episodeId, onClose }: { episodeId: string; onClose: () => void }) {
  const project = useStore((st) => st.project)
  const resplitEpisode = useStore((st) => st.resplitEpisode)

  const ep = project.episodes.find((e) => e.id === episodeId)
  const [density, setDensity] = useState<ShotDensity>('standard')
  const [sceneMode, setSceneMode] = useState<'auto' | 'custom'>('auto')

  const stats = useMemo(() => {
    if (!ep) return { scenes: 0, shots: 0, dur: 0 }
    const scenes = ep.sceneIds.map((id) => project.scenes[id]).filter(Boolean)
    const shots = scenes.reduce((n, sc) => n + sc!.shotIds.length, 0)
    const dur = scenes.reduce((n, sc) => n + sceneDuration(sc!, project.shots), 0)
    return { scenes: scenes.length, shots, dur }
  }, [ep, project])

  const [customScenes, setCustomScenes] = useState(stats.scenes)

  if (!ep) return null

  const confirm = () => {
    resplitEpisode(episodeId, { density, sceneCount: sceneMode === 'custom' ? customScenes : undefined })
    onClose()
  }

  return (
    <div className={d.overlay} onClick={onClose}>
      <div className={d.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={d.title}>
          重新拆分第 {ep.no} 集 · {ep.title}
        </div>
        <div className={s.sub}>
          当前：{stats.scenes} 场 · {stats.shots} 镜 · 约 {stats.dur} 秒
        </div>

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
          {sceneMode === 'custom' && (
            <div className={s.sceneNote}>当前版本暂不支持调整场景数量。</div>
          )}
        </div>

        <div className={s.groupTitle}>默认镜头节奏</div>
        <div className={s.seg}>
          {DENSITY.map((o) => (
            <button
              key={o.key}
              className={o.key === density ? s.segOn : ''}
              onClick={() => setDensity(o.key)}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div className={s.impact}>
          <div className={s.impactTitle}>影响说明</div>
          点「确认重新拆分」后，本集 {stats.scenes} 场 {stats.shots} 镜的原有分镜、人工修改和镜头提示词将被新结果替换；已有角色 / 服装 / 场景 / 道具继续保留，其他集不受影响。此操作不可撤销。
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
