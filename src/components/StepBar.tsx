import { useStore } from '../store/useStore'
import type { Project } from '../data/types'
import s from './StepBar.module.css'

// 剧本分析的三步流程条（v2.5 §7.2）。既是进度指示，也是演示用的跳转入口。
//
// ① 整理剧本      —— 独立的 EpisodeOrganize 页：上传 / 拆集 / 校对都收在这里。
// ② 确认资产清单  —— AssetConfirm 页。
// ③ 生成分镜脚本  —— 分镜表。
//
// 「生成提示词」**不是一步**（v2.5 §2.1）：它不换页、没有整页动效，
// 就是分镜表页脚右下角那一个主按钮；全剧就绪后同一个位置变成「去资产库生图 →」。
// 「去项目资产库生图」也不占步骤——它是下一模块的出口。
//
// 三个「中」相位各属于它要跨到的那一步：organizing→①、extracting→②、splitting→③。
// 这就是修「拆完之后步骤条默认跳到生成提示词」那个问题的地方：拆完就是第③步本身。
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
  { n: 3, label: '生成分镜脚本', sub: () => '拆场 / 拆镜 / 提示词' },
]

type Look = 'current' | 'done' | 'jumpable' | 'disabled'

export function StepBar() {
  const project = useStore((st) => st.project)
  const analysisPhase = useStore((st) => st.analysisPhase)
  const analysisStep = useStore((st) => st.analysisStep)
  const activePage = useStore((st) => st.activePage)
  const candidates = useStore((st) => st.candidates)
  const promptStates = useStore((st) => st.promptStates)
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
  const settled = analysisPhase === 'done'
  const extracted = project.episodes.some((e) => e.extractedAt)

  // 当前步（恰有一个）：在资产库(visual) → 0（三步都走完，全部显示 ✓）。
  // 相位优先于 analysisStep —— 虽然两者在 v2.5 里被刻意保持同步（点下一步的瞬间两个一起切），
  // 相位先判一遍能让「动效属于目标步骤」这条规则在代码里显式可读。
  const current =
    activePage === 'visual' ? 0
    : analysisPhase === 'organizing' || analysisPhase === 'empty' ? 1
    : analysisPhase === 'extracting' ? 2
    : analysisPhase === 'splitting' ? 3
    : analysisStep === 'episodes' ? 1
    : analysisStep === 'assetConfirm' ? 2
    : 3

  // 完成态：走过且其工作已达成。**按顺序累积**（v2.6 §1.2）——
  // 后一步的 ✓ 必须蕴含前面每一步都干完了，否则会出现「① 还没做，② 已 ✓」这种不可能的状态。
  const done: Record<number, boolean> = {
    1: extracted,                            // 任一集提取过资产 = 整理这一步的产出已交付
    2: extracted && committed,               // 已入库
    3: extracted && committed && allReady,   // 全剧提示词就绪（拆完还没生成提示词，③ 就还没干完）
  }
  // 可跳态：由数据决定的跳转上限。动效跑着的时候三步都不可点。
  const jumpable: Record<number, boolean> = {
    1: settled,                                   // 整理剧本页永远可回，跳转非销毁
    2: settled && (committed || candidates.length > 0),
    3: settled && shotsExist,
  }

  const jump = (n: number) => {
    // 三步都落在 analysis 页；App.tsx 的子页分派被 analysisPhase 卡着，
    // 所以跳转必须把相位推到 done 才能真正翻页。
    setAnalysisPhase('done')
    setPage('analysis')
    switch (n) {
      case 1: setAnalysisStep('episodes'); break
      case 2: setAnalysisStep('assetConfirm'); setTab('character'); break
      case 3: setAnalysisStep('storyboard'); setTab('shot'); break
    }
  }

  const lookOf = (n: number): Look => {
    if (n === current) return 'current'
    if (done[n]) return 'done'
    if (jumpable[n]) return 'jumpable'
    return 'disabled'
  }

  // 整理跑完之前一集都还没有 —— 第①步的副文案不许提前报出「N 集 · X 字」（§九.3）。
  const subProject =
    analysisPhase === 'empty' || analysisPhase === 'organizing' ? { ...project, episodes: [] } : project

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
                    ? settled ? '需要先完成前一步' : '正在处理中'
                    : look === 'current'
                      ? '当前步骤'
                      : `跳到「${st.label}」`
                }
              >
                <span className={s.badge}>{look === 'done' ? '✓' : st.n}</span>
                <span className={s.txt}>
                  <span className={s.label}>{st.label}</span>
                  <span className={s.sub}>{st.sub(subProject)}</span>
                </span>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
