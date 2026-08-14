import { useState } from 'react'
import { useStore } from '../store/useStore'
import { EpisodeTree } from '../components/EpisodeTree'
import { ScriptPanel } from '../components/ScriptPanel'
import { TabBar } from '../components/TabBar'
import { AssetList } from '../components/AssetList'
import { SORT_LABEL, type AssetSort } from '../components/AssetOverviewBar'
import { Storyboard } from '../components/Storyboard'
import { ScriptImportDialog } from '../components/ScriptImportDialog'
import { ResplitSceneDialog } from '../components/ResplitSceneDialog'
import { ConfirmPromptDialog } from '../components/ConfirmPromptDialog'
import { can } from '../services/capability'
import { sceneDuration } from '../services/timeline'
import ui from '../styles/ui.module.css'
import s from './ScriptAnalysis.module.css'

// 阶段① 主战场。
export function ScriptAnalysis() {
  const project = useStore((st) => st.project)
  const promptStates = useStore((st) => st.promptStates)
  const generatePrompts = useStore((st) => st.generatePrompts)
  const sceneId = useStore((st) => st.selectedSceneId)
  const activeTab = useStore((st) => st.activeTab)
  const showToast = useStore((st) => st.showToast)
  const setStage = useStore((st) => st.setStage)
  // 分镜编辑不再整页锁死；能否改镜头字段 / 挂载由能力矩阵决定（analysis 阶段恒可编辑）。
  const readOnly = !useStore((st) => can(st.project, 'editShotFields'))

  const [assetSort, setAssetSort] = useState<AssetSort>('first') // 资产表排序：四类共用
  const isAssetTab = activeTab !== 'shot'
  const [importOpen, setImportOpen] = useState(false)
  const [resplitOpen, setResplitOpen] = useState(false)
  const [promptConfirmOpen, setPromptConfirmOpen] = useState(false)

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

  // 两步式 CTA：先「生成全部提示词」，全部就绪后按钮才变「生成第一批图」。
  // 口径为全剧：need = 全部待生成 + 待更新的镜头。
  const allShotIds = Object.keys(project.shots)
  const stateOf = (id: string) => promptStates[id] ?? 'pending'
  const needIds = allShotIds.filter((id) => stateOf(id) === 'pending' || stateOf(id) === 'stale')
  const staleCount = allShotIds.filter((id) => stateOf(id) === 'stale').length
  const busy = allShotIds.some((id) => stateOf(id) === 'generating')
  const allReady = needIds.length === 0 && !busy && allShotIds.length > 0
  const genLabel =
    needIds.length === allShotIds.length ? '生成全部提示词' : `生成 ${needIds.length} 镜提示词`

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
                <button className={ui.btn} disabled={readOnly} onClick={() => setResplitOpen(true)}>
                  重新拆分本场镜头
                </button>
                <button className={ui.btn} onClick={() => showToast('已导出分镜脚本（示例，不落盘）')}>
                  导出分镜脚本
                </button>
              </>
            )}
            {isAssetTab && (
              <>
                <span className={s.sortLabel}>排序</span>
                <select
                  className={s.sortSel}
                  value={assetSort}
                  onChange={(e) => setAssetSort(e.target.value as AssetSort)}
                >
                  {(['first', 'freq', 'name'] as AssetSort[]).map((k) => (
                    <option key={k} value={k}>{SORT_LABEL[k]}</option>
                  ))}
                </select>
                <button className={ui.btn} onClick={() => showToast('已导出资产表（示例，不落盘）')}>
                  导出资产表
                </button>
              </>
            )}
            <button className={ui.btn} disabled={readOnly} onClick={() => setImportOpen(true)}>
              导入剧本
            </button>
          </div>
        </div>

        <div className={s.paneScroll}>
          {activeTab === 'shot' && scene && <Storyboard scene={scene} readOnly={readOnly} />}
          {activeTab === 'character' && <AssetList kind="character" sort={assetSort} />}
          {activeTab === 'costume' && <AssetList kind="costume" sort={assetSort} />}
          {activeTab === 'location' && <AssetList kind="location" sort={assetSort} />}
          {activeTab === 'prop' && <AssetList kind="prop" sort={assetSort} />}
        </div>

        <div className={s.foot}>
          <div className={s.info}>
            全剧 <b>{project.episodes.length} 集</b> · <b>{Object.keys(project.scenes).length} 场</b> ·{' '}
            <b>{shotTotal} 个镜头</b> · 约 {durTotal} 秒　　{counts.character} 角色（{counts.look} 角色造型）/{' '}
            {counts.costume} 服装 / {counts.location} 场景 / {counts.prop} 道具
          </div>
          {staleCount > 0 && (
            <div className={s.warn}>
              ⚠ {staleCount} 镜字段已改动，重新生成提示词后才能生成第一批图
            </div>
          )}
          {allReady ? (
            <button className={[ui.btn, ui.btnPrimary].join(' ')} onClick={() => setStage('visual')}>
              进入资产库生图 →
            </button>
          ) : (
            <button
              className={[ui.btn, ui.btnPrimary].join(' ')}
              disabled={busy || needIds.length === 0}
              onClick={() => setPromptConfirmOpen(true)}
            >
              {busy ? '提示词合成中…' : genLabel}
            </button>
          )}
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
      {promptConfirmOpen && (
        <ConfirmPromptDialog
          shotIds={needIds}
          onConfirm={(ids) => {
            generatePrompts(ids)
            setPromptConfirmOpen(false)
          }}
          onClose={() => setPromptConfirmOpen(false)}
        />
      )}
    </div>
  )
}
