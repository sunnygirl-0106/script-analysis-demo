import { useStore } from '../store/useStore'
import { STEPS } from '../components/StepBar'
import { seedProject } from '../data/seed'
import { RATE, costParse, fmtCost } from '../services/cost'
import s from './EmptyScriptState.module.css'

// 首次导入 = 解析全剧原文，按字数计价。演示的 seed 原文是逐场梗概（很短），
// 给一个代表性字数（每场约 2400 字），让价签相对「25 镜 · ✦25」量级合理。
const SCRIPT_TEXT = Object.values(seedProject.scenes).map((sc) => sc.rawText).join('\n')
const SCRIPT_SCENES = Object.keys(seedProject.scenes).length
const PARSE_COST = Math.max(costParse(SCRIPT_TEXT), Math.round((SCRIPT_SCENES * 2400) / 1000) * RATE.parsePerKChar)

// 空态（源自 空剧本.html 的 2a）：进站第一屏。点「导入剧本」= 模拟上传，随后由 App 控制器接管开拆。
// 进站指引直接复用五步流程条的 STEPS（单一真相源，见 StepBar.tsx），避免与主流程漂移。

export function EmptyScriptState() {
  const phase = useStore((st) => st.analysisPhase)
  const project = useStore((st) => st.project)
  const startUpload = useStore((st) => st.startUpload)
  const uploading = phase === 'uploading'

  return (
    <div className={s.wrap}>
      <div className={s.toolbar}>
        <button className={s.ghost} disabled={uploading} onClick={startUpload}>
          导入剧本
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

        <button className={s.cta} disabled={uploading} onClick={startUpload}>
          {uploading ? (
            <>
              <span className={s.ctaSpin} />
              正在上传《最后的尊严》…
            </>
          ) : (
            <>
              <span className={s.ctaPlus}>＋</span>解析剧本 · {fmtCost(PARSE_COST)}
            </>
          )}
        </button>
        <div className={s.hint}>支持 txt / docx / fdx · 按字数计费</div>

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
    </div>
  )
}
