import { useState } from 'react'
import { useStore } from '../store/useStore'
import { EpisodeTree } from '../components/EpisodeTree'
import { ScriptPanel } from '../components/ScriptPanel'
import { TabBar } from '../components/TabBar'
import { AssetList } from '../components/AssetList'
import { SORT_LABEL, type AssetSort } from '../components/AssetOverviewBar'
import { Storyboard } from '../components/Storyboard'
import { PanelResizer } from '../components/PanelResizer'
import { ConfirmPromptDialog } from '../components/ConfirmPromptDialog'
import type { PromptScope } from '../services/promptScope'
import { can } from '../services/capability'
import { sceneDuration } from '../services/timeline'
import { unreferencedCount } from '../services/reference'
import ui from '../styles/ui.module.css'
import s from './ScriptAnalysis.module.css'

// 步骤③④ 的主战场：分镜表。
// v2.4 §六 收口：工具栏 shot tab 只留「导出分镜脚本」——重拆本场的唯一入口在场级 ⋯ 菜单里，
// 「导入剧本」整个退役（补充剧本在步骤① 整理剧本页）。页脚「去资产库生图」常驻，
// 提示词没全就绪时置灰而不是整个换掉——客户上次找不到下一步，就是因为它不在。
export function ScriptAnalysis() {
  const project = useStore((st) => st.project)
  const promptStates = useStore((st) => st.promptStates)
  const generatePrompts = useStore((st) => st.generatePrompts)
  const setStage = useStore((st) => st.setStage)
  const sceneId = useStore((st) => st.selectedSceneId)
  const activeTab = useStore((st) => st.activeTab)
  const showToast = useStore((st) => st.showToast)
  const scriptOpen = useStore((st) => st.scriptOpen)
  const usageIndex = useStore((st) => st.usageIndex())
  const episodeW = useStore((st) => st.episodeW)
  const scriptW = useStore((st) => st.scriptW)
  const setPanelW = useStore((st) => st.setPanelW)
  // 分镜编辑不再整页锁死；能否改镜头字段 / 挂载由能力矩阵决定（analysis 阶段恒可编辑）。
  const readOnly = !useStore((st) => can(st.project, 'editShotFields'))

  const [assetSort, setAssetSort] = useState<AssetSort>('first') // 资产表排序：四类共用
  const isAssetTab = activeTab !== 'shot'
  // 生成弹窗：null = 关闭；打开时记住本次范围（页脚按钮=本场，完成度提示=全剧）。
  const [promptScope, setPromptScope] = useState<PromptScope | null>(null)

  const scene = project.scenes[sceneId]

  const shotTotal = Object.values(project.scenes).reduce((n, sc) => n + sc.shotIds.length, 0)
  const durTotal = Object.values(project.scenes).reduce((n, sc) => n + sceneDuration(sc, project.shots), 0)
  // 未引用资产计数（删场/删集不删资产的可视化出口，§4.2）。
  const unrefTotal = unreferencedCount(usageIndex)

  // 分镜页页脚只留一个动作：「生成提示词」。去资产库生图是下一步——全部就绪后走流程条⑤「资产库生图」。
  // 口径为全剧：need = 全部待生成 + 待更新的镜头。数量统计只进完成度提示行，不进按钮文案。
  const allShotIds = Object.keys(project.shots)
  const stateOf = (id: string) => promptStates[id] ?? 'pending'
  const needIds = allShotIds.filter((id) => stateOf(id) === 'pending' || stateOf(id) === 'stale')
  const staleCount = allShotIds.filter((id) => stateOf(id) === 'stale').length
  const busy = allShotIds.some((id) => stateOf(id) === 'generating')
  // 含至少一个待生成镜头的场数。
  const needSceneCount = new Set(needIds.map((id) => project.shots[id]?.sceneId)).size
  // 全剧提示词已就绪：页脚引导从「生成提示词」切换为「去资产库生图」（= 流程条⑤，进库交付第一批）。
  const allReady = allShotIds.length > 0 && needIds.length === 0 && !busy

  return (
    <div className={s.page}>
      <EpisodeTree />
      <PanelResizer getWidth={() => episodeW} onResize={(w) => setPanelW('episode', w)} />
      <ScriptPanel />
      {scriptOpen && (
        <PanelResizer getWidth={() => scriptW} onResize={(w) => setPanelW('script', w)} />
      )}

      <div className={s.rcol}>
        <div className={s.toolbar}>
          <TabBar scene={scene} />
          <div className={s.tbr}>
            {activeTab === 'shot' && (
              <button className={ui.btn} onClick={() => showToast('已导出分镜脚本（示例，不落盘）')}>
                导出分镜脚本
              </button>
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
          </div>
        </div>

        <div className={s.paneScroll}>
          {activeTab === 'shot' && scene && <Storyboard scene={scene} readOnly={readOnly} />}
          {activeTab === 'character' && <AssetList kind="character" sort={assetSort} />}
          {activeTab === 'costume' && <AssetList kind="costume" sort={assetSort} />}
          {activeTab === 'location' && <AssetList kind="location" sort={assetSort} />}
          {activeTab === 'prop' && <AssetList kind="prop" sort={assetSort} />}
        </div>

        <div className={s.foot} id="genPromptsFooter">
          <div className={s.info}>
            全剧 <b>{project.episodes.length} 集</b> · <b>{Object.keys(project.scenes).length} 场</b> ·{' '}
            <b>{shotTotal} 个镜头</b> · 约 {durTotal} 秒
            {unrefTotal > 0 && <span className={s.unrefTag}> · {unrefTotal} 项当前剧本未引用</span>}
          </div>
          {needIds.length > 0 ? (
            <button className={s.doneLink} onClick={() => setPromptScope('project')}>
              {needSceneCount} 场 {needIds.length} 个镜头待生成提示词
              {staleCount > 0 && `（含 ${staleCount} 镜内容已改动待更新）`} →
            </button>
          ) : (
            allReady && (
              <span className={s.doneStatic}>全剧 {allShotIds.length} 个镜头提示词已就绪</span>
            )
          )}
          {!allReady && (
            <button
              className={ui.btn}
              disabled={busy}
              onClick={() => setPromptScope('scene')}
            >
              {busy ? '生成中…' : '生成提示词'}
            </button>
          )}
          <button
            className={[ui.btn, ui.btnPrimary].join(' ')}
            disabled={!allReady}
            title={allReady ? undefined : '全剧提示词就绪后可进入'}
            onClick={() => setStage('visual')}
          >
            去资产库生图 →
          </button>
        </div>
      </div>

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
