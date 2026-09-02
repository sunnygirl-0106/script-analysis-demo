import { useStore } from '../store/useStore'
import type { Project } from '../data/types'
import s from './StepBar.module.css'

// 剧本分析的五步流程条。既是进度指示，也是演示用的跳转入口。
// 可跳的上限由数据决定：未入库只能到②，入库后到③，有提示词后到④，全就绪才到⑤。
//
// ④ 和 ⑤ 在本仓库里不是独立页面：④ 是分镜表页脚的「生成提示词」动作，⑤ 是 VisualPrep 页。
// 所以点④ = 跳到分镜表并滚到页脚 CTA，点⑤ = setPage('visual')。这不是漏做了两个页面。
//
// STEPS 是单一真相源：本组件与 EmptyScriptState 的进站指引共用同一份。
export const STEPS: { n: number; label: string; sub: (p: Project) => string }[] = [
  { n: 1, label: '导入剧本', sub: (p) => `${p.episodes.length} 集` },
  { n: 2, label: '确认资产清单', sub: () => '全剧' },
  { n: 3, label: '生成分镜脚本', sub: () => '集 / 场 / 镜' },
  { n: 4, label: '生成提示词', sub: () => '逐镜画面 / 视频' },
  { n: 5, label: '资产库生图', sub: () => '第一批出图' },
]

type Look = 'current' | 'done' | 'jumpable' | 'disabled'

export function StepBar() {
  const project = useStore((st) => st.project)
  const analysisPhase = useStore((st) => st.analysisPhase)
  const analysisStep = useStore((st) => st.analysisStep)
  const activePage = useStore((st) => st.activePage)
  const promptStates = useStore((st) => st.promptStates)
  const selectedSceneId = useStore((st) => st.selectedSceneId)
  const replayDemo = useStore((st) => st.replayDemo)
  const setAnalysisStep = useStore((st) => st.setAnalysisStep)
  const setPage = useStore((st) => st.setPage)
  const setStage = useStore((st) => st.setStage)
  const setTab = useStore((st) => st.setTab)

  const committed = project.libraryCommittedAt != null
  const shotIds = Object.keys(project.shots)
  const shotsExist = shotIds.length > 0
  const stateOf = (id: string) => promptStates[id] ?? 'pending'
  const busy = shotIds.some((id) => stateOf(id) === 'generating')
  const needCount = shotIds.filter((id) => stateOf(id) === 'pending' || stateOf(id) === 'stale').length
  const allReady = shotsExist && needCount === 0 && !busy
  const hasReadyPrompt = shotIds.some((id) => stateOf(id) === 'ready')
  const settled = analysisPhase === 'done' // 动画/空态阶段一律算在第①步，不认 analysisStep
  const onStoryboard = settled && analysisStep === 'storyboard' && activePage === 'analysis'

  // 当前步（恰有一个）：视觉页 → ⑤；未完成动画 → ①；确认页 → ②；分镜页有 ready 提示词 → ④ 否则 ③。
  const current =
    activePage === 'visual' ? 5
    : analysisPhase !== 'done' ? 1
    : analysisStep === 'assetConfirm' ? 2
    : onStoryboard ? (hasReadyPrompt ? 4 : 3)
    : 3

  // 完成态：走过且其工作已达成。
  const done: Record<number, boolean> = {
    1: analysisPhase === 'done',
    2: committed,
    3: committed && shotsExist,
    4: allReady,
    5: false,
  }
  // 可跳态：由数据决定的跳转上限（§7 铁律：不能跳到自相矛盾的状态）。
  const jumpable: Record<number, boolean> = {
    1: true,
    2: true,
    3: committed && shotsExist,
    4: committed && shotsExist,
    5: allReady,
  }

  const scrollToFooter = () => {
    // ④ = 分镜页动作，跳过去后把页脚「生成提示词」CTA 滚进视野。
    window.setTimeout(() => {
      document.getElementById('genPromptsFooter')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 80)
  }

  const jump = (n: number) => {
    if (n === current) return
    switch (n) {
      case 1: replayDemo(); break
      case 2: setAnalysisStep('assetConfirm'); setTab('character'); setPage('analysis'); break
      case 3: setAnalysisStep('storyboard'); setTab('shot'); setPage('analysis'); break
      case 4: setAnalysisStep('storyboard'); setTab('shot'); setPage('analysis'); scrollToFooter(); break
      // ⑤ 资产库生图：只有全部提示词就绪才可跳（jumpable[5] = allReady）。
      // 走 setStage 而非 setPage —— 进资产库这一刻交付第一批资产（deliverFirstBatch）。
      case 5: setStage('visual'); break
    }
  }

  const lookOf = (n: number): Look => {
    if (n === current) return 'current'
    if (done[n]) return 'done'
    if (jumpable[n]) return 'jumpable'
    return 'disabled'
  }

  // 作用域标签：阶段② 说明「集 / 场 / 镜还没产生」；阶段③ 报出当前集场。
  const scene = project.scenes[selectedSceneId]
  const epNo = scene ? project.episodes.find((e) => e.sceneIds.includes(scene.id))?.no : undefined
  const scopeText =
    analysisStep === 'assetConfirm'
      ? '整本剧本 · 集 / 场 / 镜在第 ③ 步产生'
      : onStoryboard && scene
        ? `第 ${epNo ?? scene.episodeId} 集 · 第 ${scene.no} 场`
        : null

  return (
    <div className={s.bar}>
      <div className={s.steps}>
        {STEPS.map((st, i) => {
          const look = lookOf(st.n)
          const clickable = look !== 'current' && look !== 'disabled'
          return (
            <div className={s.stepWrap} key={st.n}>
              {i > 0 && <span className={s.sep} />}
              <button
                className={[s.step, s[look]].filter(Boolean).join(' ')}
                disabled={!clickable}
                onClick={() => clickable && jump(st.n)}
                title={
                  look === 'disabled'
                    ? '需要先完成前一步'
                    : look === 'current'
                      ? '当前步骤'
                      : `跳到「${st.label}」`
                }
              >
                <span className={s.badge}>{look === 'done' ? '✓' : st.n}</span>
                <span className={s.txt}>
                  <span className={s.label}>{st.label}</span>
                  <span className={s.sub}>{st.sub(project)}</span>
                </span>
              </button>
            </div>
          )
        })}
      </div>

      {scopeText && (
        <div className={s.scope}>
          <span className={s.scopeLabel}>当前作用域</span>
          <span className={s.scopeVal}>{scopeText}</span>
        </div>
      )}
    </div>
  )
}
