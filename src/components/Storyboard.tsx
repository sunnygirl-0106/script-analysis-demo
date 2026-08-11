import { useState } from 'react'
import { useStore } from '../store/useStore'
import type { Scene } from '../data/types'
import { computeTimeline, sceneDuration } from '../services/timeline'
import { SceneTimeline } from './SceneTimeline'
import { SceneSettingsDrawer } from './SceneSettingsDrawer'
import { ShotRow } from './ShotRow'
import s from './Storyboard.module.css'

function fmt(sec: number): string {
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`
}

export function Storyboard({ scene, readOnly }: { scene: Scene; readOnly: boolean }) {
  const shots = useStore((st) => st.project.shots)

  // 高亮完全由悬停驱动：不悬停就没有任何镜被高亮。
  const [hoverId, setHoverId] = useState<string | null>(null)

  const timeline = computeTimeline(scene, shots)
  const total = sceneDuration(scene, shots)

  return (
    <div className={s.pane}>
      <SceneSettingsDrawer />
      <SceneTimeline scene={scene} shots={shots} activeId={hoverId} onHover={setHoverId} />
      {readOnly && <div className={s.lockNote}>🔒 已进入视觉筹备，剧本分析只读</div>}

      <div className={s.scroll}>
        <div className={s.grid}>
          <div className={s.header}>
            <div className={s.hCell}>镜号 · 时长</div>
            <div className={s.hCell}>关联资产</div>
            <div className={s.hCell}>镜头</div>
            <div className={s.hCell}>画面提示词</div>
            <div className={s.hCell}>视频提示词</div>
          </div>

          {timeline.map((entry) => {
            const shot = shots[entry.shotId]
            if (!shot) return null
            return (
              <ShotRow
                key={shot.id}
                shot={shot}
                startAt={entry.startAt}
                endAt={entry.endAt}
                active={hoverId === shot.id}
                readOnly={readOnly}
                onHover={setHoverId}
              />
            )
          })}

          <div className={s.tail}>
            <div className={s.tailNo}>{fmt(total)}</div>
            <div className={s.tailText}>本场结束 · 共 {total}s</div>
          </div>
        </div>
      </div>
    </div>
  )
}
