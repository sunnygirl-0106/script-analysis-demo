import { useMemo, useState } from 'react'
import { DRILLS, freshDrillStore, type Drill, type DrillRun } from '../services/drills'
import s from './RuleCheatPanel.module.css'

// 右下角规则速查面板（§7.2）。叠加物，不替代任何既有按钮。
// 每条演练可点着跑：把项目复位到样例状态 → 执行 → 弹「核对卡」看变化量。
// 与 tests/drills.test.ts 共用同一份 DRILLS（单一真相源）。

interface CheckCard {
  op: string
  label: string
  before: { lib: number; cand: number; scenes: number; shots: number }
  after: { lib: number; cand: number; scenes: number; shots: number }
  gate: boolean
}

export function RuleCheatPanel() {
  const [open, setOpen] = useState(false)
  const [card, setCard] = useState<CheckCard | null>(null)

  const groups = useMemo(() => {
    const map = new Map<string, Drill[]>()
    for (const d of DRILLS) {
      const arr = map.get(d.group) ?? []
      arr.push(d)
      map.set(d.group, arr)
    }
    return [...map.entries()]
  }, [])

  const runDrill = (drill: Drill, run: DrillRun) => {
    // 跑之前收起面板，避免挡住可能弹出的确认闸。
    setOpen(false)
    const api = freshDrillStore()
    run.arm?.(api)
    api.act.resetTrace()
    const before = api.snapshot()
    run.run(api)
    const after = api.snapshot()
    setCard({ op: drill.op, label: run.label, before, after, gate: api.get().trace.sawIncrementalGate })
    // 跑完自动展开并显示核对卡。
    setOpen(true)
  }

  return (
    <>
      {!open && (
        <button className={s.pill} onClick={() => setOpen(true)} title="打开规则速查">
          ▤ 规则速查
        </button>
      )}

      {open && (
        <div className={s.panel}>
          <div className={s.head}>
            <span className={s.title}>规则速查 · 点着跑</span>
            <button className={s.close} onClick={() => setOpen(false)} title="收起">⊟</button>
          </div>
          <div className={s.note}>演练会把项目复位到样例状态后执行，用于核对规则口径。</div>

          {card && (
            <div className={s.card}>
              <div className={s.cardTitle}>{card.op} · {card.label}</div>
              <div className={s.cardRow}>
                <span>项目资产库</span>
                <b className={card.after.lib !== card.before.lib ? s.hot : ''}>
                  {card.before.lib} → {card.after.lib}
                </b>
              </div>
              <div className={s.cardRow}>
                <span>是否开闸</span>
                <b className={card.gate ? s.hot : ''}>{card.gate ? '开闸（停下等确认）' : '未开闸'}</b>
              </div>
              <div className={s.cardRow}>
                <span>分镜 场 · 镜</span>
                <b>{card.before.scenes}·{card.before.shots} → {card.after.scenes}·{card.after.shots}</b>
              </div>
              <div className={s.cardRow}>
                <span>待确认候选</span>
                <b className={card.after.cand !== card.before.cand ? s.hot : ''}>
                  {card.before.cand} → {card.after.cand}
                </b>
              </div>
            </div>
          )}

          <div className={s.body}>
            {groups.map(([group, drills]) => (
              <div key={group} className={s.group}>
                <div className={s.groupHead}>{group}</div>
                {drills.map((d) => (
                  <div key={d.id} className={s.drill}>
                    <div className={s.drillTop}>
                      <span className={s.op}>{d.op}</span>
                      <span className={s.tags}>
                        <i className={s.tag}>库 {d.lib}</i>
                        <i className={s.tag}>{d.stop}</i>
                      </span>
                    </div>
                    {d.runs.map((r, i) => (
                      <button key={i} className={s.runBtn} onClick={() => runDrill(d, r)}>
                        ▷ {r.label}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
