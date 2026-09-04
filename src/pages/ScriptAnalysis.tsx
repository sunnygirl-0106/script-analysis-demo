import { useState } from 'react'
import { useStore } from '../store/useStore'
import { EpisodeTree } from '../components/EpisodeTree'
import { ScriptPanel } from '../components/ScriptPanel'
import { Storyboard } from '../components/Storyboard'
import { PanelResizer } from '../components/PanelResizer'
import { ConfirmPromptDialog } from '../components/ConfirmPromptDialog'
import { GoVisualDialog } from '../components/GoVisualDialog'
import { FlowButton, FlowLink } from '../components/FlowButton'
import { can } from '../services/capability'
import { costShotPrompts } from '../services/cost'
import { sceneDuration } from '../services/timeline'
import { scopeScenes } from '../services/viewScope'
import { ic } from '../components/icons'
import ui from '../styles/ui.module.css'
import s from './ScriptAnalysis.module.css'

// 步骤③ 的主战场：分镜表。
// 顶部那排「分镜脚本 / 角色 / 服装 / 场景 / 道具」tab 整个撤掉——这一页就是一张大表。
// 四类资产在步骤② 已经确认过一遍，之后的归宿是项目资产库那一页，不需要在分镜页再开一个入口。
// 工具栏最后只剩「导出分镜脚本」一个按钮——为一个按钮留 52px 一整行不值当，
// 它缩成页脚最左边的一个图标（v2.8 §4），右侧从上到下只剩表格 + 页脚。
//
// 表格铺什么由左侧目录的视图作用域决定——默认全剧，点集看一集，点场看一场。
//
// 
//   左  全剧概览（不再报「N 项未引用」——那是资产库该操心的事，不是分镜页的）
//   中  一条细进度条 + `3 / 25`，整组可点 = 打开全剧范围的生成弹窗
//   右  `直接去资产库生图 →`（灰字链） + `生成全部提示词 · ✦N`（最右，全就绪后消失）
//
// 最右那一颗永远是「这一步的出口」。「去资产库生图」是跳过这一步的岔路，
// 所以它退成主按钮左边的一条灰字链——两颗按钮并排会让人以为这是两条平级的路。
// 提示词全生完后主按钮消失，岔路成了唯一的路，这时它才接过流光站到最右。
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
  const wordTotal = project.episodes.reduce((n, e) => n + e.wordCount, 0)
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
        <div className={s.paneScroll}>
          <Storyboard scenes={scenes} readOnly={readOnly} showTimeline={viewScope.kind === 'scene'} />
        </div>

        <div className={s.foot} id="genPromptsFooter">
          {/* 导出分镜脚本。原来这里是个「下载」箭头，孤零零挂在页脚最左边，
              没人看得出它导的是什么——换成导出图标，并配一条自己的悬浮说明，
              不吃系统 title 那一秒多的延迟。 */}
          <button
            className={[ui.btn, s.iconBtn].join(' ')}
            aria-label="导出分镜脚本"
            onClick={() => showToast('已导出分镜脚本（示例，不落盘）')}
          >
            {ic.exportOut}
            <span className={s.tip}>导出分镜脚本</span>
          </button>
          {/* 集数 / 字数说的是「剧本体量」，场 / 镜 / 秒说的是「拆解产物」，前后各占一半。
              字数原先挂在步骤条第①步后面，步骤条改版后不留小字了，统一并到这里。 */}
          <div className={s.info}>
            全剧 <b>{project.episodes.length} 集</b> · <b>{wordTotal.toLocaleString()} 字</b> ·{' '}
            <b>{Object.keys(project.scenes).length} 场</b> · <b>{shotTotal} 镜</b> · 约 {durTotal} 秒
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

          {/* 最右永远是这一步的出口。提示词没生全时，出口是「生成全部提示词」，
              「直接去资产库生图」退成它左边的一条灰字链——那是跳过这一步的岔路，
              跟主按钮并排成一对按钮会让人以为两条路平级。
              全生完之后主按钮消失，这条岔路就是唯一的路，接过流光站到最右。 */}
          {allReady ? (
            <FlowButton icon="arrow" onClick={() => setStage('visual')}>
              去资产库生图
            </FlowButton>
          ) : (
            <>
              <FlowLink onClick={() => setGoVisualOpen(true)}>直接去资产库生图</FlowLink>
              <FlowButton
                busy={busy}
                disabled={needIds.length === 0}
                cost={busy ? undefined : costShotPrompts(needIds)}
                onClick={() => setPromptOpen(true)}
              >
                {busy ? '生成中…' : '生成全部提示词'}
              </FlowButton>
            </>
          )}
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
