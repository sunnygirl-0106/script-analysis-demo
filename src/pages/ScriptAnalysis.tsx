import { useStore } from '../store/useStore'
import { EpisodeTree } from '../components/EpisodeTree'
import { ScriptPanel } from '../components/ScriptPanel'
import { TabBar } from '../components/TabBar'
import { AssetGrid } from '../components/AssetGrid'
import { Storyboard } from '../components/Storyboard'
import { DensitySwitch } from '../components/DensitySwitch'
import { AddEpisodeDialog } from '../components/AddEpisodeDialog'
import { sceneDuration } from '../services/timeline'
import ui from '../styles/ui.module.css'
import s from './ScriptAnalysis.module.css'

// 阶段① 主战场。
export function ScriptAnalysis() {
  const project = useStore((st) => st.project)
  const sceneId = useStore((st) => st.selectedSceneId)
  const activeTab = useStore((st) => st.activeTab)
  const viewMode = useStore((st) => st.viewMode)
  const setViewMode = useStore((st) => st.setViewMode)
  const readOnly = !useStore((st) => st.canEditAnalysis())
  const resplit = useStore((st) => st.resplit)
  const setStage = useStore((st) => st.setStage)

  const scene = project.scenes[sceneId]

  const shotTotal = Object.values(project.scenes).reduce((n, sc) => n + sc.shotIds.length, 0)
  const durTotal = Object.values(project.scenes).reduce((n, sc) => n + sceneDuration(sc, project.shots), 0)
  const counts = {
    character: Object.values(project.assets).filter((a) => a.kind === 'character').length,
    location: Object.values(project.assets).filter((a) => a.kind === 'location').length,
    prop: Object.values(project.assets).filter((a) => a.kind === 'prop').length,
    costume: Object.values(project.assets).filter((a) => a.kind === 'costume').length,
  }

  return (
    <div className={s.page}>
      <EpisodeTree />
      <ScriptPanel />

      <div className={s.rcol}>
        <div className={s.toolbar}>
          <TabBar scene={scene} />
          <div className={s.tbr}>
            {activeTab === 'shot' && (
              <>
                <div className={s.seg}>
                  <button className={viewMode === 'brief' ? s.on : ''} onClick={() => setViewMode('brief')}>
                    速览
                  </button>
                  <button className={viewMode === 'dual' ? s.on : ''} onClick={() => setViewMode('dual')}>
                    对照
                  </button>
                </div>
                <DensitySwitch disabled={readOnly} />
                <button className={ui.btn} disabled={readOnly} onClick={() => resplit(sceneId)}>
                  重拆本场
                </button>
              </>
            )}
            <AddEpisodeDialog disabled={readOnly} />
          </div>
        </div>

        <div className={s.paneScroll}>
          {activeTab === 'shot' && scene && <Storyboard scene={scene} readOnly={readOnly} />}
          {activeTab === 'character' && <AssetGrid kind="character" />}
          {activeTab === 'location' && <AssetGrid kind="location" />}
          {activeTab === 'prop' && <AssetGrid kind="prop" />}
        </div>

        <div className={s.foot}>
          <div className={s.info}>
            全剧 <b>{project.episodes.length} 集</b> · <b>{Object.keys(project.scenes).length} 场</b> ·{' '}
            <b>{shotTotal} 镜</b> · 约 {durTotal}s　　{counts.character} 人物 / {counts.location} 场景 /{' '}
            {counts.prop} 道具 / {counts.costume} 组着装
          </div>
          <button className={[ui.btn, ui.btnPrimary].join(' ')} onClick={() => setStage('visual')}>
            进入视觉筹备 →
          </button>
        </div>
      </div>
    </div>
  )
}
