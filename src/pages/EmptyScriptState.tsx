import { useStore } from '../store/useStore'
import s from './EmptyScriptState.module.css'

// 空态（源自 空剧本.html 的 2a）：进站第一屏。点「导入剧本」= 模拟上传，随后由 App 控制器接管开拆。
const STEPS = [
  { n: '1', title: '导入剧本', sub: '上传文件' },
  { n: '2', title: '自动拆解', sub: '集 · 场 · 镜头' },
  { n: '3', title: '生成提示词', sub: '进资产库生图' },
]

export function EmptyScriptState() {
  const phase = useStore((st) => st.analysisPhase)
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
              <span className={s.ctaPlus}>＋</span>导入剧本
            </>
          )}
        </button>
        <div className={s.hint}>支持 txt / docx / fdx</div>

        <div className={s.steps}>
          <span className={s.stepLine} />
          <div className={s.stepRow}>
            {STEPS.map((st, i) => (
              <div className={s.step} key={st.n}>
                <span className={[s.stepDot, i === 0 ? s.stepDotOn : ''].join(' ')}>{st.n}</span>
                <span className={[s.stepTitle, i === 0 ? s.stepTitleOn : ''].join(' ')}>{st.title}</span>
                <span className={s.stepSub}>{st.sub}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
