import { useState } from 'react'
import { useStore } from '../store/useStore'
import { EpisodeTree } from '../components/EpisodeTree'
import { ScriptPanel } from '../components/ScriptPanel'
import { TabBar } from '../components/TabBar'
import { AssetGrid } from '../components/AssetGrid'
import { Storyboard } from '../components/Storyboard'
import { ScriptImportDialog } from '../components/ScriptImportDialog'
import { ResplitSceneDialog } from '../components/ResplitSceneDialog'
import { ConfirmStageDialog } from '../components/ConfirmStageDialog'
import { sceneDuration } from '../services/timeline'
import ui from '../styles/ui.module.css'
import s from './ScriptAnalysis.module.css'

// 阶段① 主战场。
export function ScriptAnalysis() {
  const project = useStore((st) => st.project)
  const sceneId = useStore((st) => st.selectedSceneId)
  const activeTab = useStore((st) => st.activeTab)
  // 字段级权限取代整页只读：脚本与提示词恒可编辑（进入视觉筹备后返回仍可改）。
  const readOnly = false

  const [importOpen, setImportOpen] = useState(false)
  const [resplitOpen, setResplitOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

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
              <button className={ui.btn} disabled={readOnly} onClick={() => setResplitOpen(true)}>
                重拆本场
              </button>
            )}
            <button className={ui.btn} disabled={readOnly} onClick={() => setImportOpen(true)}>
              导入剧本
            </button>
          </div>
        </div>

        <div className={s.paneScroll}>
          {activeTab === 'shot' && scene && <Storyboard scene={scene} readOnly={readOnly} />}
          {activeTab === 'character' && <AssetGrid kind="character" />}
          {activeTab === 'costume' && <AssetGrid kind="costume" />}
          {activeTab === 'location' && <AssetGrid kind="location" />}
          {activeTab === 'prop' && <AssetGrid kind="prop" />}
        </div>

        <div className={s.foot}>
          <div className={s.info}>
            全剧 <b>{project.episodes.length} 集</b> · <b>{Object.keys(project.scenes).length} 场</b> ·{' '}
            <b>{shotTotal} 镜</b> · 约 {durTotal}s　　{counts.character} 角色 / {counts.costume} 服装 /{' '}
            {counts.location} 场景 / {counts.prop} 道具
          </div>
          <button className={[ui.btn, ui.btnPrimary].join(' ')} onClick={() => setConfirmOpen(true)}>
            资产生产 →
          </button>
        </div>
      </div>

      <ScriptImportDialog
        open={importOpen}
        scope="project"
        defaultMode="append"
        onClose={() => setImportOpen(false)}
      />
      {resplitOpen && scene && (
        <ResplitSceneDialog sceneId={scene.id} onClose={() => setResplitOpen(false)} />
      )}
      {confirmOpen && <ConfirmStageDialog onClose={() => setConfirmOpen(false)} />}
    </div>
  )
}
