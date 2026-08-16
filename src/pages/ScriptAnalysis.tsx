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
import type { PromptScope } from '../services/promptScope'
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
  // 生成弹窗：null = 关闭；打开时记住本次范围（页脚按钮=本场，完成度提示=全剧）。
  const [promptScope, setPromptScope] = useState<PromptScope | null>(null)

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

  // 两步式 CTA：「生成提示词」（次要，恒可点）与「进入资产库生图」（主，全就绪才可点）共存。
  // 口径为全剧：need = 全部待生成 + 待更新的镜头。数量统计只进完成度提示行，不进按钮文案。
  const allShotIds = Object.keys(project.shots)
  const stateOf = (id: string) => promptStates[id] ?? 'pending'
  const needIds = allShotIds.filter((id) => stateOf(id) === 'pending' || stateOf(id) === 'stale')
  const staleCount = allShotIds.filter((id) => stateOf(id) === 'stale').length
  const busy = allShotIds.some((id) => stateOf(id) === 'generating')
  const allReady = needIds.length === 0 && !busy && allShotIds.length > 0
  // 含至少一个待生成镜头的场数。
  const needSceneCount = new Set(needIds.map((id) => project.shots[id]?.sceneId)).size

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
          {needIds.length > 0 ? (
            <button className={s.doneLink} onClick={() => setPromptScope('project')}>
              {needSceneCount} 场 {needIds.length} 个镜头待生成提示词
              {staleCount > 0 && `（含 ${staleCount} 镜内容已改动待更新）`} →
            </button>
          ) : (
            allShotIds.length > 0 && (
              <span className={s.doneStatic}>全剧 {allShotIds.length} 个镜头提示词已就绪</span>
            )
          )}
          <button
            className={ui.btn}
            disabled={busy}
            onClick={() => setPromptScope('scene')}
          >
            {busy ? '生成中…' : '生成提示词'}
          </button>
          <button
            className={[ui.btn, ui.btnPrimary].join(' ')}
            disabled={!allReady}
            title={allReady ? undefined : `还有 ${needIds.length} 个镜头的提示词未生成`}
            onClick={() => setStage('visual')}
          >
            进入资产库生图 →
          </button>
        </div>
      </div>

      <ScriptImportDialog
        open={importOpen}
        defaultMode="append"
        onClose={() => setImportOpen(false)}
      />
      {resplitOpen && scene && (
        <ResplitSceneDialog sceneId={scene.id} onClose={() => setResplitOpen(false)} />
      )}
      {promptScope && (
        <ConfirmPromptDialog
          defaultScope={promptScope}
          onConfirm={(ids) => {
            generatePrompts(ids)
            setPromptScope(null)
          }}
          onClose={() => setPromptScope(null)}
        />
      )}
    </div>
  )
}
