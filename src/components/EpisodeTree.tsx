import { useStore } from '../store/useStore'
import { sceneDuration } from '../services/timeline'
import s from './EpisodeTree.module.css'

export function EpisodeTree() {
  const project = useStore((st) => st.project)
  const selectedSceneId = useStore((st) => st.selectedSceneId)
  const selectScene = useStore((st) => st.selectScene)

  const episodeCount = project.episodes.length
  const sceneCount = Object.keys(project.scenes).length

  return (
    <div className={s.side}>
      <div className={s.head}>
        集 · 场
        <span className={s.rt}>
          {episodeCount} 集 · {sceneCount} 场
        </span>
      </div>
      <div className={s.tree}>
        {project.episodes.map((ep, ei) => {
          const scenes = ep.sceneIds.map((id) => project.scenes[id]!).filter(Boolean)
          const shotTotal = scenes.reduce((n, sc) => n + sc.shotIds.length, 0)
          const durTotal = scenes.reduce((n, sc) => n + sceneDuration(sc, project.shots), 0)
          return (
            <div key={ep.id}>
              {ei > 0 && <div className={s.epgap} />}
              <div className={s.ep}>
                <div className={s.epTitle}>
                  第 {ep.no} 集 · {ep.title}
                </div>
                <div className={s.epSub}>
                  {scenes.length} 场 · {shotTotal} 镜 · {durTotal}s
                </div>
              </div>
              {scenes.map((sc) => (
                <div
                  key={sc.id}
                  className={[s.sc, sc.id === selectedSceneId ? s.on : ''].join(' ')}
                  onClick={() => selectScene(sc.id)}
                >
                  第 {sc.no} 场 {sc.name}
                  <span className={s.d}>{sc.shotIds.length} 镜</span>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
