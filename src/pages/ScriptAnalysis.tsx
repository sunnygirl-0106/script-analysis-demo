import { useState } from 'react'
import { useStore } from '../store/useStore'
import { EpisodeTree } from '../components/EpisodeTree'
import { ScriptPanel } from '../components/ScriptPanel'
import { TabBar } from '../components/TabBar'
import { AssetList } from '../components/AssetList'
import { Storyboard } from '../components/Storyboard'
import { ScriptImportDialog } from '../components/ScriptImportDialog'
import { ResplitSceneDialog } from '../components/ResplitSceneDialog'
import { ConfirmStageDialog } from '../components/ConfirmStageDialog'
import { can } from '../services/capability'
import { sceneDuration } from '../services/timeline'
import ui from '../styles/ui.module.css'
import s from './ScriptAnalysis.module.css'

// 阶段① 主战场。
export function ScriptAnalysis() {
  const project = useStore((st) => st.project)
  const sceneId = useStore((st) => st.selectedSceneId)
  const activeTab = useStore((st) => st.activeTab)
  // 分镜编辑不再整页锁死；能否改镜头字段 / 挂载由能力矩阵决定（analysis 阶段恒可编辑）。
  const readOnly = !useStore((st) => can(st.project, 'editShotFields'))

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
    look: Object.values(project.assets).filter((a) => a.kind === 'look').length,
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
                重新拆分本场镜头
              </button>
            )}
            <button className={ui.btn} disabled={readOnly} onClick={() => setImportOpen(true)}>
              导入剧本
            </button>
          </div>
        </div>

        <div className={s.paneScroll}>
          {activeTab === 'shot' && scene && <Storyboard scene={scene} readOnly={readOnly} />}
          {activeTab === 'character' && <AssetList kind="character" />}
          {activeTab === 'costume' && <AssetList kind="costume" />}
          {activeTab === 'location' && <AssetList kind="location" />}
          {activeTab === 'prop' && <AssetList kind="prop" />}
        </div>

        <div className={s.foot}>
          <div className={s.info}>
            全剧 <b>{project.episodes.length} 集</b> · <b>{Object.keys(project.scenes).length} 场</b> ·{' '}
            <b>{shotTotal} 个镜头</b> · 约 {durTotal} 秒　　{counts.character} 角色（{counts.look} 角色造型）/{' '}
            {counts.costume} 服装 / {counts.location} 场景 / {counts.prop} 道具
          </div>
          <button className={[ui.btn, ui.btnPrimary].join(' ')} onClick={() => setConfirmOpen(true)}>
            生成第一批 →
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
