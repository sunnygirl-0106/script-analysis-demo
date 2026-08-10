import { useStore } from '../store/useStore'
import type { Scene } from '../data/types'
import s from './SceneTrackBar.module.css'

// ★ 场级栏：配乐 / 情绪 / 完整台词。这些内容跨镜，挂在单个镜上没有意义。
export function SceneTrackBar({ scene, readOnly }: { scene: Scene; readOnly: boolean }) {
  const updateTrack = useStore((st) => st.updateSceneTrack)

  return (
    <div className={s.bar}>
      <div className={s.cell}>
        <div className={s.head}>
          <span className={[s.dot, s.dotBgm].join(' ')} />
          配乐建议
        </div>
        <textarea
          className={s.text}
          value={scene.track.bgm}
          disabled={readOnly}
          placeholder="这一场的配乐走向…"
          onChange={(e) => updateTrack(scene.id, { bgm: e.target.value })}
        />
      </div>
      <div className={s.cell}>
        <div className={s.head}>
          <span className={[s.dot, s.dotMood].join(' ')} />
          情绪走向
        </div>
        <textarea
          className={s.text}
          value={scene.track.mood}
          disabled={readOnly}
          placeholder="这一场的情绪…"
          onChange={(e) => updateTrack(scene.id, { mood: e.target.value })}
        />
      </div>
      <div className={s.cell}>
        <div className={s.head}>
          <span className={[s.dot, s.dotDlg].join(' ')} />
          完整台词
        </div>
        <textarea
          className={s.text}
          value={scene.track.fullDialogue}
          disabled={readOnly}
          placeholder="连起来才能配音的完整台词…"
          onChange={(e) => updateTrack(scene.id, { fullDialogue: e.target.value })}
        />
      </div>
    </div>
  )
}
