import { useStore } from '../store/useStore'
import { STEPS } from '../components/StepBar'
import { TaskProgress } from '../components/TaskProgress'
import s from './EmptyScriptState.module.css'

// 空态（源自 空剧本.html 的 2a）：进站第一屏。v2.4 §3.1 起只有两拍——
// 点「＋ 上传剧本」（不带价签）→ hero 原地切成 3.6s 的「整理中」→ 落到整理剧本页。
// 没有确认花费弹窗：上传 / 研读 / 拆集免费，整理剧本页本身就是预估结果页，付费按钮在那一页的页脚。
const ORGANIZE_MS = 3600

export function EmptyScriptState() {
  const phase = useStore((st) => st.analysisPhase)
  const project = useStore((st) => st.project)
  const startUpload = useStore((st) => st.startUpload)
  const finishOrganize = useStore((st) => st.finishOrganize)

  const organizing = phase === 'organizing'

  // 整理中的三段文案：让用户看见系统在读他的剧本、在切集，而不是干等一个转圈。
  const organizePhases = [
    { label: `正在读取《${project.title}》`, weight: 1 },
    { label: '研读剧本中，整理剧本内容', weight: 1 },
    { label: '正在识别剧集边界', weight: 1 },
  ]

  // 进站指引里的第①步还没有任何产出，所以按「空剧本」渲染副文案（STEPS 仍是单一真相源）。
  const emptyProject = { ...project, episodes: [] }

  return (
    <div className={s.wrap}>
      <div className={s.hero}>
        <div className={s.glow} />
        <div className={s.dots} />

        <div className={s.doc}>
          <span className={s.ring1} />
          <span className={s.ring2} />
          <div className={[s.card, s.card1].join(' ')} />
          <div className={[s.card, s.card2].join(' ')} />
          <div className={[s.card, s.cardFront].join(' ')}>
            <span className={s.lineAcc} />
            <span className={s.line} style={{ width: '100%' }} />
            <span className={s.line} style={{ width: '80%' }} />
            <span className={s.line} style={{ width: '92%' }} />
            <span className={s.line} style={{ width: '54%' }} />
            <span className={s.line} style={{ width: '70%' }} />
          </div>
          <span className={s.spark1} />
          <span className={s.spark2} />
        </div>

        <div className={s.title}>这个项目还没有剧本</div>
        <div className={s.sub}>
          上传剧本后，自动整理成集并校对，随后提取角色、服装、场景、道具四类资产。
        </div>

        {organizing ? (
          <div className={s.estimateBox}>
            <TaskProgress phases={organizePhases} durationMs={ORGANIZE_MS} onDone={finishOrganize} />
          </div>
        ) : (
          <button className={s.cta} onClick={startUpload}>
            <span className={s.ctaPlus}>＋</span>上传剧本
          </button>
        )}
        <div className={s.hint}>支持 txt / docx / fdx</div>

        <div className={s.steps}>
          <span className={s.stepLine} />
          <div className={s.stepRow}>
            {STEPS.map((step, i) => (
              <div className={s.step} key={step.n}>
                <span className={[s.stepDot, i === 0 ? s.stepDotOn : ''].join(' ')}>{step.n}</span>
                <span className={[s.stepTitle, i === 0 ? s.stepTitleOn : ''].join(' ')}>{step.label}</span>
                <span className={s.stepSub}>{step.sub(emptyProject)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
