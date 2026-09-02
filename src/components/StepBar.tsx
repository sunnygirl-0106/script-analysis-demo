import { useStore } from '../store/useStore'
import type { Project } from '../data/types'
import s from './StepBar.module.css'

// 剧本分析的四步流程条（v2.4 §七）。既是进度指示，也是演示用的跳转入口。
//
// ① 整理剧本      —— 独立的 EpisodeOrganize 页：上传 / 拆集 / 校对都收在这里。
// ② 确认资产清单  —— AssetConfirm 页。
// ③ 生成分镜脚本  —— 还没拆是 SplitStart 起点页（选节奏），拆完是分镜表。
// ④ 生成提示词    —— 不是独立页面：分镜表页脚的「生成提示词」动作，点④ = 跳分镜表并滚到页脚 CTA。
//
// 「去项目资产库生图」是下一模块的出口，不占步骤——只由分镜表页脚那个主按钮进入。
//
// STEPS 是单一真相源：本组件与 EmptyScriptState 的进站指引共用同一份。
const fmtWords = (p: Project) =>
  `${p.episodes.reduce((n, e) => n + e.wordCount, 0).toLocaleString()} 字`

export const STEPS: { n: number; label: string; sub: (p: Project) => string }[] = [
  {
    n: 1,
    label: '整理剧本',
    sub: (p) => (p.episodes.length ? `${p.episodes.length} 集 · ${fmtWords(p)}` : '上传 / 拆集 / 校对'),
  },
  { n: 2, label: '确认资产清单', sub: () => '角色 / 服装 / 场景 / 道具' },
  { n: 3, label: '生成分镜脚本', sub: () => '拆场 / 拆镜' },
  { n: 4, label: '生成提示词', sub: () => '逐镜画面 / 视频' },
]

type Look = 'current' | 'done' | 'jumpable' | 'disabled'

export function StepBar() {
  const project = useStore((st) => st.project)
  const analysisPhase = useStore((st) => st.analysisPhase)
  const analysisStep = useStore((st) => st.analysisStep)
  const activePage = useStore((st) => st.activePage)
  const candidates = useStore((st) => st.candidates)
  const promptStates = useStore((st) => st.promptStates)
  const selectedSceneId = useStore((st) => st.selectedSceneId)
  const setAnalysisStep = useStore((st) => st.setAnalysisStep)
  const setAnalysisPhase = useStore((st) => st.setAnalysisPhase)
  const setPage = useStore((st) => st.setPage)
  const setTab = useStore((st) => st.setTab)

  const committed = project.libraryCommittedAt != null
  const shotIds = Object.keys(project.shots)
  const shotsExist = shotIds.length > 0
  const stateOf = (id: string) => promptStates[id] ?? 'pending'
  const busy = shotIds.some((id) => stateOf(id) === 'generating')
  const needCount = shotIds.filter((id) => stateOf(id) === 'pending' || stateOf(id) === 'stale').length
  const allReady = shotsExist && needCount === 0 && !busy
  const settled = analysisPhase === 'done' // 空态 / 整理中 / 提取中一律算在第①步，不认 analysisStep
  const onStoryboard = settled && analysisStep === 'storyboard' && activePage === 'analysis'
  // 还没提取过资产的草稿集：有它在，③ 就不该能跳（该先把它提了）。
  const hasDraft = project.episodes.some((e) => !e.extractedAt)
  const extracted = project.episodes.some((e) => e.extractedAt)

  // 当前步（恰有一个）：在资产库(visual) → 0（四步都走完，全部显示 ✓）。
  // 分镜已生成 ⇒ ③ 的活干完了，当前步是 ④「生成提示词」——哪怕一条提示词都还没生成。
  // （§七 的规则表写的是「有 shots 且有 ready 才 4」，但 §十.8 的验收要的是「拆完 ①②③ 全 ✓、④ 当前」：
  //   面对一张已经拆好的分镜表还把 ③ 标成「进行中」，用户找不到下一步。取后者。）
  const current =
    activePage === 'visual' ? 0
    : !settled || analysisStep === 'episodes' ? 1
    : analysisStep === 'assetConfirm' ? 2
    : shotsExist ? 4
    : 3

  // 完成态：走过且其工作已达成。
  const done: Record<number, boolean> = {
    1: extracted,        // 任一集提取过资产 = 整理这一步的产出已交付
    2: committed,        // 已入库
    3: shotsExist,       // 分镜已生成
    4: allReady,         // 全剧提示词就绪
  }
  // 可跳态：由数据决定的跳转上限（不能跳到自相矛盾的状态）。
  const jumpable: Record<number, boolean> = {
    1: settled,                        // 整理剧本页永远可回，跳转非销毁
    2: committed || candidates.length > 0,
    3: committed && !hasDraft,         // 有草稿集没提取，不该能进拆分
    4: shotsExist,
  }

  const scrollToFooter = () => {
    // ④ = 分镜页动作，跳过去后把页脚「生成提示词」CTA 滚进视野。
    window.setTimeout(() => {
      document.getElementById('genPromptsFooter')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 80)
  }

  const jump = (n: number) => {
    // 四步都落在 analysis 页；App.tsx 的子页分派被 analysisPhase 卡着，
    // 所以跳转必须把相位推到 done 才能真正翻页。
    setAnalysisPhase('done')
    setPage('analysis')
    switch (n) {
      case 1: setAnalysisStep('episodes'); break
      case 2: setAnalysisStep('assetConfirm'); setTab('character'); break
      case 3: setAnalysisStep('storyboard'); setTab('shot'); break
      case 4: setAnalysisStep('storyboard'); setTab('shot'); scrollToFooter(); break
    }
  }

  const lookOf = (n: number): Look => {
    if (n === current) return 'current'
    if (done[n]) return 'done'
    if (jumpable[n]) return 'jumpable'
    return 'disabled'
  }

  // 作用域标签：步骤①② 只有集，明说场 / 镜还没产生；步骤③ 之后才报集场。
  const scene = project.scenes[selectedSceneId]
  const epNo = scene ? project.episodes.find((e) => e.sceneIds.includes(scene.id))?.no : undefined
  const scopeText =
    analysisStep === 'episodes' || analysisStep === 'assetConfirm'
      ? '整本剧本 · 场 / 镜在第 ③ 步产生'
      : onStoryboard && scene
        ? `第 ${epNo ?? scene.episodeId} 集 · 第 ${scene.no} 场`
        : null

  return (
    <div className={s.bar}>
      <div className={s.steps}>
        {STEPS.map((st, i) => {
          const look = lookOf(st.n)
          // 当前步也可点（点了就在原地重新导航一次，幂等）；只有 disabled 不可点。
          const clickable = look !== 'disabled'
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
