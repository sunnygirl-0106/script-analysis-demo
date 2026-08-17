import { useStore } from '../store/useStore'
import { checklist, STAGE_PROGRESS } from '../services/analysisTimeline'
import s from './AnalyzeHud.module.css'

// 解析中主面板加载态（源自 空剧本.html 2b）：文档 + 双环 spinner + 进度条 + 四步 checklist。
// 常驻主内容区居中，直到分镜脚本开始构建（stage≥3）才由 AnalyzingWorkspace 换成真实表格。
export function AnalyzeHud() {
  const project = useStore((st) => st.project)
  const stage = useStore((st) => st.revealStage)
  const phase = useStore((st) => st.analysisPhase)
  const done = phase === 'done'

  const epN = project.episodes.length
  const scN = Object.keys(project.scenes).length
  const steps = checklist(stage, done)
  const pct = done ? 100 : STAGE_PROGRESS[Math.min(stage, STAGE_PROGRESS.length - 1)]

  const countLine =
    stage >= 1 ? (
      <>
        已识别 <b>{epN} 集</b> · <b>{scN} 场</b> · 正在拆分镜头…
      </>
    ) : (
      <>正在读取剧本结构…</>
    )

  return (
    <div className={s.stage}>
      <div className={s.glow} />
      <div className={s.dots} />

      <div className={s.big}>
        <div className={s.spinner}>
          <span className={s.halo} />
          <span className={s.ringA} />
          <span className={s.ringB} />
          <span className={s.ringSpin} />
          <span className={s.ringSpin2} />
          <span className={s.miniDoc}>
            <span className={s.mLineAcc} />
            <span className={s.mLine} style={{ width: '100%' }} />
            <span className={s.mLine} style={{ width: '74%' }} />
            <span className={s.mLine} style={{ width: '88%' }} />
          </span>
        </div>

        <div className={s.bigTitle}>正在解析《{project.title}》</div>
        <div className={s.bigCount}>{countLine}</div>

        <div className={s.bigBar}>
          <div className={s.track}>
            <span className={s.fill} style={{ width: `${pct}%` }}>
              <span className={s.sheen} />
            </span>
          </div>
        </div>

        <div className={s.checklist}>
          {steps.map((step) => (
            <div key={step.label} className={[s.step, s[step.state]].join(' ')}>
              <span className={s.stepMark}>
                {step.state === 'done' ? '✓' : step.state === 'active' ? <span className={s.pulse} /> : ''}
              </span>
              {step.label}
            </div>
          ))}
        </div>

        <div className={s.foot}>解析约需 1–2 分钟，可先离开本页，完成后会通知你</div>
      </div>
    </div>
  )
}
