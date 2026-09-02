import { useStore } from '../store/useStore'
import { STEPS } from '../components/StepBar'
import { TaskProgress } from '../components/TaskProgress'
import { UploadConfirmDialog } from '../components/UploadConfirmDialog'
import s from './EmptyScriptState.module.css'

// 空态（源自 空剧本.html 的 2a）：进站第一屏。上传四拍见 v2.3 §二。
// 第一拍上传（按钮不带价签）→ 第二拍预估中(3–5s，复用 TaskProgress) → 第三拍确认花费弹窗
// → 第四拍点确认进 analyzing。取消回空态、什么都没发生。
const ESTIMATE_MS = 3600

export function EmptyScriptState() {
  const phase = useStore((st) => st.analysisPhase)
  const project = useStore((st) => st.project)
  const startUpload = useStore((st) => st.startUpload)
  const setAnalysisPhase = useStore((st) => st.setAnalysisPhase)

  const estimating = phase === 'estimating'
  const confirming = phase === 'confirm'
  const busy = estimating || confirming

  // 第二拍文案：先读剧本、再估消耗（让用户看见系统在读他的剧本，不是纯等待）。
  const estimatePhases = [
    { label: `正在读取《${project.title}》`, weight: 1 },
    { label: '正在预估拆解与资产提取的消耗', weight: 1 },
  ]

  return (
    <div className={s.wrap}>
      <div className={s.toolbar}>
        <button className={s.ghost} disabled={busy} onClick={startUpload}>
          上传剧本
        </button>
      </div>

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
          导入剧本后，自动拆出集、场与镜头，并整理角色、服装、场景、道具四类资产。
        </div>

        {estimating ? (
          <div className={s.estimateBox}>
            <TaskProgress
              phases={estimatePhases}
              durationMs={ESTIMATE_MS}
              onDone={() => setAnalysisPhase('confirm')}
            />
          </div>
        ) : (
          <button className={s.cta} disabled={busy} onClick={startUpload}>
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
                <span className={s.stepSub}>{step.sub(project)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 第三拍：确认花费弹窗。取消回空态；确认进 analyzing。 */}
      {confirming && (
        <UploadConfirmDialog
          onCancel={() => setAnalysisPhase('empty')}
          onConfirm={() => setAnalysisPhase('analyzing')}
        />
      )}
    </div>
  )
}
