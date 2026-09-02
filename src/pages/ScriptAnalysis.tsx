import { useState } from 'react'
import { useStore } from '../store/useStore'
import { EpisodeTree } from '../components/EpisodeTree'
import { ScriptPanel } from '../components/ScriptPanel'
import { Storyboard } from '../components/Storyboard'
import { PanelResizer } from '../components/PanelResizer'
import { ConfirmPromptDialog } from '../components/ConfirmPromptDialog'
import { GoVisualDialog } from '../components/GoVisualDialog'
import { can } from '../services/capability'
import { costShotPrompts, fmtCost } from '../services/cost'
import { sceneDuration } from '../services/timeline'
import { scopeScenes } from '../services/viewScope'
import ui from '../styles/ui.module.css'
import s from './ScriptAnalysis.module.css'

// 步骤③ 的主战场：分镜表。
// v2.6 §5.1：顶部那排「分镜脚本 / 角色 / 服装 / 场景 / 道具」tab 整个撤掉——这一页就是一张大表。
// 四类资产在步骤② 已经确认过一遍，之后的归宿是项目资产库那一页，不需要在分镜页再开一个入口。
// 工具栏因此只剩「导出分镜脚本」。
//
// v2.7 §五：表格铺什么由左侧目录的视图作用域决定——默认全剧，点集看一集，点场看一场。
//
// v2.7 §5.6 页脚三段：
//   左  全剧概览（不再报「N 项未引用」——那是资产库该操心的事，不是分镜页的）
//   中  一条细进度条 + `3 / 25`，整组可点 = 打开全剧范围的生成弹窗
//   右  `生成全部提示词 · ✦N`（全就绪后消失） + `去资产库生图 →`（永远在最右）
//
// 「去资产库生图」从此永远在同一个位置，只换轻重：未就绪是 ghost，点了弹软提醒；
// 全就绪变主按钮直接进资产库。v2.6 那个文字链接「先去资产库生图 →」由它接管，删掉——
// 同一件事有两个入口，用户就得先判断这两个有什么区别。
export function ScriptAnalysis() {
  const project = useStore((st) => st.project)
  const promptStates = useStore((st) => st.promptStates)
  const generatePrompts = useStore((st) => st.generatePrompts)
  const setStage = useStore((st) => st.setStage)
  const viewScope = useStore((st) => st.viewScope)
  const showToast = useStore((st) => st.showToast)
  const scriptOpen = useStore((st) => st.scriptOpen)
  const episodeW = useStore((st) => st.episodeW)
  const scriptW = useStore((st) => st.scriptW)
  const setPanelW = useStore((st) => st.setPanelW)
  // 分镜编辑不再整页锁死；能否改镜头字段 / 挂载由能力矩阵决定（analysis 阶段恒可编辑）。
  const readOnly = !useStore((st) => can(st.project, 'editShotFields'))

  // 生成弹窗：null = 关闭；打开时记住本次范围（本轮所有入口都是全剧，弹窗里仍可缩小）。
  const [promptOpen, setPromptOpen] = useState(false)
  // 「现在去生图？」软提醒：只在还有镜头没生成提示词时可能出现。
  const [goVisualOpen, setGoVisualOpen] = useState(false)

  const scenes = scopeScenes(project, viewScope)

  const shotTotal = Object.values(project.scenes).reduce((n, sc) => n + sc.shotIds.length, 0)
  const durTotal = Object.values(project.scenes).reduce((n, sc) => n + sceneDuration(sc, project.shots), 0)

  // 口径为全剧：need = 全部待生成 + 待更新的镜头。数量统计只进进度条，不进按钮文案。
  const allShotIds = Object.keys(project.shots)
  const stateOf = (id: string) => promptStates[id] ?? 'pending'
  const needIds = allShotIds.filter((id) => stateOf(id) === 'pending' || stateOf(id) === 'stale')
  const staleCount = allShotIds.filter((id) => stateOf(id) === 'stale').length
  const busy = allShotIds.some((id) => stateOf(id) === 'generating')
  const readyCount = allShotIds.length - needIds.length
  const pct = allShotIds.length ? (readyCount / allShotIds.length) * 100 : 0
  // 全剧提示词已就绪：「生成全部提示词」消失，「去资产库生图 →」变亮。
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
          <div className={s.tbr}>
            <button className={ui.btn} onClick={() => showToast('已导出分镜脚本（示例，不落盘）')}>
              导出分镜脚本
            </button>
          </div>
        </div>

        <div className={s.paneScroll}>
          <Storyboard scenes={scenes} readOnly={readOnly} showTimeline={viewScope.kind === 'scene'} />
        </div>

        <div className={s.foot} id="genPromptsFooter">
          <div className={s.info}>
            全剧 <b>{project.episodes.length} 集</b> · <b>{Object.keys(project.scenes).length} 场</b> ·{' '}
            <b>{shotTotal} 镜</b> · 约 {durTotal} 秒
          </div>

          {/* 进度条（v2.7 §5.6）：一句长文案换成一根 120px 的条 + `3 / 25`。整组可点。 */}
          {allShotIds.length > 0 && (
            <button
              className={s.progWrap}
              disabled={busy}
              title={busy ? '正在生成提示词' : '生成全剧提示词'}
              onClick={() => setPromptOpen(true)}
            >
              <span className={s.progLabel}>提示词</span>
              <span className={s.progTrack}>
                <span className={s.progFill} style={{ width: `${pct}%` }} />
              </span>
              <span className={s.progNum}>
                {readyCount} / {allShotIds.length}
              </span>
              {busy ? (
                <span className={s.progNote}>生成中…</span>
              ) : allReady ? (
                <span className={s.progNote}>已就绪</span>
              ) : (
                staleCount > 0 && <span className={s.progStale}>· {staleCount} 待更新</span>
              )}
            </button>
          )}

          {!allReady && (
            <button
              className={[ui.btn, ui.btnPrimary].join(' ')}
              disabled={busy || needIds.length === 0}
              onClick={() => setPromptOpen(true)}
            >
              {busy ? '生成中…' : `生成全部提示词 · ${fmtCost(costShotPrompts(needIds))}`}
            </button>
          )}
          <button
            className={[ui.btn, allReady ? ui.btnPrimary : ''].join(' ')}
            onClick={() => (allReady ? setStage('visual') : setGoVisualOpen(true))}
          >
            去资产库生图 →
          </button>
        </div>
      </div>

      {goVisualOpen && (
        <GoVisualDialog needIds={needIds} onClose={() => setGoVisualOpen(false)} />
      )}

      {promptOpen && (
        <ConfirmPromptDialog
          defaultScope="project"
          onConfirm={(ids) => {
            generatePrompts(ids)
            setPromptOpen(false)
          }}
          onClose={() => setPromptOpen(false)}
        />
      )}
    </div>
  )
}
