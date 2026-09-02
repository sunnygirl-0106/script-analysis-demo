import { useStore } from '../store/useStore'
import { TaskProgress } from '../components/TaskProgress'
import { PHASES } from '../services/taskRun'
import s from './AnalyzingWorkspace.module.css'

// 第四拍：解析中（v2.3 §3.1）。这一步只提取资产、不拆镜头，所以不再分阶段揭示集场/分镜/Storyboard
// ——那是早期演示遗留、与步骤二无关。跑完一段解析进度后，直接落阶段② 资产确认页。
const PARSE_MS = 3400

export function AnalyzingWorkspace() {
  const title = useStore((st) => st.project.title)
  const finishFirstImport = useStore((st) => st.finishFirstImport)
  const setAnalysisPhase = useStore((st) => st.setAnalysisPhase)

  const done = () => {
    finishFirstImport()
    setAnalysisPhase('done')
  }

  return (
    <div className={s.parseWrap}>
      <div className={s.parseGlow} />
      <div className={s.parseCard}>
        <div className={s.parseTitle}>正在解析《{title}》</div>
        <div className={s.parseSub}>划分集与场、提取角色 · 服装 · 场景 · 道具并生成提示词，随后进入资产确认。</div>
        <TaskProgress phases={PHASES.parse} durationMs={PARSE_MS} onDone={done} />
      </div>
    </div>
  )
}
