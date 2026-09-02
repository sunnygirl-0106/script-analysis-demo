import { useStore } from '../store/useStore'
import { ScriptIllustration } from '../components/ScriptIllustration'
import { useTaskTimeline } from '../hooks/useTaskTimeline'
import { PHASES, splitPhases, type Phase } from '../services/taskRun'
import { DENSITY_LABEL } from '../services/density'
import s from './FullPageProcess.module.css'

// 整页动效（v2.5 §四）。三个相位共用这一个组件，只换文案：
//   organizing → 整理剧本页 ／ extracting → 资产确认页 ／ splitting → 分镜表
//
// 原则：**动效页属于目标步骤，不属于来源步骤**。用户点的是「进入下一步」，
// 步骤条在点下去的瞬间就已经切到下一步了（见 store 的 startExtract / beginSplit），
// 这一页是「下一步正在干活」的样子，所以页面上不出现任何来源步骤的结论
// （整理没跑完之前，不许有「共 N 集 · X 字」）。
//
// 页面上没有任何按钮：要跳过就用顶栏那颗 pill。

// 演示口径的时长。标题里的「预计耗时 5 / 8 分钟」是产品文案，不是真实计时。
const DURATION = { organizing: 4200, extracting: 4000, splitting: 4500 } as const

export function FullPageProcess() {
  const phase = useStore((st) => st.analysisPhase)
  const title = useStore((st) => st.project.title)
  const pendingDensity = useStore((st) => st.pendingDensity)
  const defaultDensity = useStore((st) => st.project.defaultDensity)
  const finishOrganize = useStore((st) => st.finishOrganize)
  const finishExtract = useStore((st) => st.finishExtract)
  const finishSplit = useStore((st) => st.finishSplit)

  if (phase !== 'organizing' && phase !== 'extracting' && phase !== 'splitting') return null

  const densityLabel = DENSITY_LABEL[pendingDensity ?? defaultDensity]
  const script: Record<typeof phase, { heading: string; phases: Phase[]; onDone: () => void }> = {
    organizing: { heading: `正在研读《${title}》`, phases: PHASES.organize, onDone: finishOrganize },
    extracting: { heading: '资产提取中，预计耗时 5 分钟', phases: PHASES.extract, onDone: finishExtract },
    splitting: { heading: '分镜拆解中，预计耗时 8 分钟', phases: splitPhases(densityLabel), onDone: finishSplit },
  }
  const { heading, phases, onDone } = script[phase]

  // key=phase：换相位就是换一次任务，时间线要重排（hook 只在挂载时排一次）。
  return <Process key={phase} heading={heading} phases={phases} durationMs={DURATION[phase]} onDone={onDone} />
}

function Process({
  heading, phases, durationMs, onDone,
}: {
  heading: string
  phases: Phase[]
  durationMs: number
  onDone: () => void
}) {
  const { idx, done, barPct, barMs, label } = useTaskTimeline(phases, durationMs, onDone)

  return (
    <div className={s.wrap} role="status" aria-live="polite">
      <div className={s.glow} />
      <div className={s.center}>
        <ScriptIllustration active />
        <div className={s.title}>
          {heading}
          <span className={s.dots} aria-hidden>
            <i /><i /><i />
          </span>
        </div>
        {/* key=idx：换一句就重放一次淡入，上一句同时被替换掉。 */}
        <div className={s.phase} key={idx}>
          {done ? phases[phases.length - 1]?.label : label}
        </div>
        <div className={s.track}>
          <div className={s.fill} style={{ width: `${barPct}%`, transitionDuration: `${barMs}ms` }} />
        </div>
      </div>
    </div>
  )
}
