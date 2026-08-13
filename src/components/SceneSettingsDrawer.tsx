import { useEffect } from 'react'
import { useStore } from '../store/useStore'
import { can } from '../services/capability'
import { sceneDuration } from '../services/timeline'
import s from './SceneSettingsDrawer.module.css'

function fmt(sec: number): string {
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`
}

// ★ 场级设定抽屉：情绪走向 + 配乐建议。看一眼就走的东西，按需打开，不常驻。
// 剧本拆解不生产声音，只输出场级的声音设计意图；配乐生成属于拍摄台，这里只有文字，没有生成按钮。
export function SceneSettingsDrawer() {
  const open = useStore((st) => st.sceneSettingsOpen)
  const close = useStore((st) => st.closeSceneSettings)
  const sceneId = useStore((st) => st.selectedSceneId)
  const scene = useStore((st) => st.project.scenes[sceneId])
  const shots = useStore((st) => st.project.shots)
  const updateTrack = useStore((st) => st.updateSceneTrack)
  const readOnly = !useStore((st) => can(st.project, 'editSceneTrack'))

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, close])

  if (!open || !scene) return null
  const total = sceneDuration(scene, shots)

  return (
    <div className={s.mask} onClick={close}>
      <aside className={s.drawer} onClick={(e) => e.stopPropagation()}>
        <div className={s.head}>
          <div className={s.hTitle}>本场设置</div>
          <button className={s.close} onClick={close} title="关闭（Esc）">
            ✕
          </button>
        </div>
        <div className={s.sub}>
          第 {scene.no} 场 · {scene.name}
        </div>
        <div className={s.sub2}>
          {scene.shotIds.length} 镜 · 全场 {fmt(total)}
        </div>

        <div className={s.body}>
          <label className={s.field}>
            <span className={s.label}>情绪走向</span>
            <textarea
              className={s.text}
              rows={3}
              value={scene.track.mood}
              disabled={readOnly}
              placeholder="这一场的情绪走向…"
              onChange={(e) => updateTrack(scene.id, { mood: e.target.value })}
            />
          </label>

          <label className={s.field}>
            <span className={s.label}>配乐建议</span>
            <textarea
              className={s.text}
              rows={3}
              value={scene.track.bgm}
              disabled={readOnly}
              placeholder="这一场的配乐走向…"
              onChange={(e) => updateTrack(scene.id, { bgm: e.target.value })}
            />
            {/* 去向标注，不是按钮 —— 声音归属拍摄台。 */}
            <span className={s.dest}>将在拍摄台用于生成整场配乐</span>
          </label>
        </div>

        <div className={s.note}>
          ⓘ 这里的配乐方向将用于生成整场配乐，无需逐个镜头填写。
        </div>
      </aside>
    </div>
  )
}
