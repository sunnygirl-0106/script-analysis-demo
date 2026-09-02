import { useStore } from '../store/useStore'
import { TaskProgress } from '../components/TaskProgress'
import { costExtract } from '../services/cost'
import { PHASES, taskDuration } from '../services/taskRun'
import s from './AnalyzingWorkspace.module.css'

// 步骤①的最后一下：提取资产（v2.4 §3.3）。这里**只**提取资产——
// 集已经在整理那一步分好了，场和镜要等步骤③「开始拆分」才产生。跑完落步骤② 资产确认页。
export function AnalyzingWorkspace() {
  const title = useStore((st) => st.project.title)
  const episodes = useStore((st) => st.project.episodes)
  const finishExtract = useStore((st) => st.finishExtract)

  // 本次提取的范围 = 还没上锁的集。
  const drafts = episodes.filter((e) => !e.extractedAt)
  const nos = drafts.map((e) => e.no)
  const scope = nos.length > 1 ? `第 ${nos[0]}–${nos[nos.length - 1]} 集` : `第 ${nos[0] ?? 1} 集`
  const words = drafts.reduce((n, e) => n + e.wordCount, 0)

  return (
    <div className={s.parseWrap}>
      <div className={s.parseGlow} />
      <div className={s.parseCard}>
        <div className={s.parseTitle}>正在提取《{title}》{scope}的资产</div>
        <div className={s.parseSub}>提取角色 · 服装 · 场景 · 道具并生成提示词，随后进入资产确认。</div>
        <TaskProgress
          phases={PHASES.parse}
          durationMs={taskDuration(costExtract(words))}
          onDone={finishExtract}
        />
      </div>
    </div>
  )
}
