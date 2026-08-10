import { useStore } from '../store/useStore'
import type { Scene } from '../data/types'
import { computeTimeline, sceneDuration } from '../services/timeline'
import { ShotRow } from './ShotRow'
import s from './Storyboard.module.css'

export function Storyboard({ scene, readOnly }: { scene: Scene; readOnly: boolean }) {
  const shots = useStore((st) => st.project.shots)
  const expandedShotId = useStore((st) => st.expandedShotId)
  const viewMode = useStore((st) => st.viewMode)

  const timeline = computeTimeline(scene, shots)
  const total = sceneDuration(scene, shots)

  return (
    <div className={s.pane}>
      <div className={s.subbar}>
        <b>
          第 {scene.no} 场 {scene.name}
        </b>
        <span>
          {scene.shotIds.length} 镜 · {total}s
        </span>
        <span className={s.rt}>
          {readOnly ? (
            <span className={s.lockNote}>🔒 已进入视觉筹备，剧本分析只读</span>
          ) : (
            <span>画面提示词 → 生关键帧　·　视频提示词 → 生视频</span>
          )}
        </span>
      </div>

      <div className={s.scroll}>
        <table className={s.sb}>
          <colgroup>
            <col style={{ width: '56px' }} />
            <col style={{ width: '224px' }} />
            <col />
            <col style={{ width: '116px' }} />
          </colgroup>
          <thead>
            <tr>
              <th>镜</th>
              <th>关联资产</th>
              <th>本镜内容</th>
              <th>时长</th>
            </tr>
          </thead>
          <tbody>
            {timeline.map((entry) => {
              const shot = shots[entry.shotId]
              if (!shot) return null
              return (
                <ShotRow
                  key={shot.id}
                  shot={shot}
                  expanded={expandedShotId === shot.id}
                  viewMode={viewMode}
                  readOnly={readOnly}
                />
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
