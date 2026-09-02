import { useState } from 'react'
import { useStore } from '../store/useStore'
import type { ShotDensity } from '../data/types'
import { seedProject } from '../data/seed'
import { estimateShots, costSplitByWords, fmtCost } from '../services/cost'
import { PHASES, taskDuration } from '../services/taskRun'
import { TaskProgress } from '../components/TaskProgress'
import ui from '../styles/ui.module.css'
import s from './SplitStart.module.css'

// 步骤③ 的起点页（v2.4 §5.2）：还没拆分时看到的就是这一页，不是空的分镜表。
// 三张节奏卡从弹窗搬到页面上——选节奏是这一步唯一的决策，它就该是这一页的主体。
//
// 镜数是估的，所以永远写「约 N 镜」；价格由字数 × 档位系数算出，是确定值，不写区间。
const DENSITY_META: { key: ShotDensity; label: string; desc: string }[] = [
  { key: 'compact', label: '紧凑', desc: '高频切镜，动作与对白推进更快' },
  { key: 'standard', label: '标准', desc: '叙事、动作与情绪留白相对均衡' },
  { key: 'loose', label: '舒缓', desc: '长镜头更多，保留表演和发酵' },
]

export function SplitStart() {
  const project = useStore((st) => st.project)
  const startSplit = useStore((st) => st.startSplit)
  const [density, setDensity] = useState<ShotDensity>(project.defaultDensity)
  const [running, setRunning] = useState(false)

  // 本次要拆的集：已提取资产、还没有场的那些。
  const targets = project.episodes.filter((e) => e.extractedAt && e.sceneIds.length === 0)
  const words = targets.reduce((n, e) => n + e.wordCount, 0)
  // 演示里 seed 就是「拆完」的参照，所以场数与镜数的估值都从它来。
  const seedSceneIds = Object.keys(seedProject.scenes)
  const estScenes = seedSceneIds.length
  const estShotsOf = (dn: ShotDensity) => estimateShots(seedSceneIds, dn)
  const costOf = (dn: ShotDensity) => costSplitByWords(words, dn)
  const cost = costOf(density)

  return (
    <div className={s.page}>
      <div className={s.center}>
        <div className={s.title}>选择全剧默认镜头节奏</div>
        <div className={s.sub}>
          全剧 {targets.length} 集 · {words.toLocaleString()} 字 · 预计约 {estScenes} 场
        </div>

        {running ? (
          <div className={s.progressBox}>
            <TaskProgress
              phases={PHASES.split}
              durationMs={taskDuration(cost)}
              onDone={() => startSplit({ density })}
            />
          </div>
        ) : (
          <div className={s.cards}>
            {DENSITY_META.map((m) => {
              const on = density === m.key
              return (
                <button
                  key={m.key}
                  className={[s.card, on ? s.cardOn : ''].join(' ')}
                  onClick={() => setDensity(m.key)}
                >
                  <div className={s.cardHead}>
                    {m.label}
                    {on && <span className={s.check}>✓</span>}
                  </div>
                  <div className={s.cardDesc}>{m.desc}</div>
                  <div className={s.cardShots}>约 {estShotsOf(m.key)} 镜</div>
                  <div className={s.cardCost}>{fmtCost(costOf(m.key))}</div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className={s.foot}>
        <div className={s.footNote}>
          ✓ 本次将使用项目资产库中的现有资产，不新增。
        </div>
        <div className={s.footEst}>预计耗时约 1 分钟 · 拆完可逐场重拆</div>
        <button
          className={[ui.btn, ui.btnPrimary].join(' ')}
          disabled={running}
          onClick={() => setRunning(true)}
        >
          {running ? '拆分中…' : `开始拆分 · ${fmtCost(cost)}`}
        </button>
      </div>
    </div>
  )
}
