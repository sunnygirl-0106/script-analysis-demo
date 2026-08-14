import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import ui from '../styles/ui.module.css'
import d from './ScriptImportDialog.module.css'
import c from './ConfirmPromptDialog.module.css'

// 「生成全部提示词」前置确认 = 合成账单。对齐 GVLM「合成最终提示词」参考稿：
// 逐镜勾选 + 全选 + 费用随勾选联动。模型下拉与「智能合成/自动拼接」为演示视觉控件，
// 不进数据模型、不影响生成——真正落地的只是对勾选镜调用 generatePrompts。
export function ConfirmPromptDialog({
  shotIds,
  onConfirm,
  onClose,
}: {
  shotIds: string[]
  onConfirm: (ids: string[]) => void
  onClose: () => void
}) {
  const project = useStore((st) => st.project)

  // 按「集 → 场 → 镜」的自然顺序排列，回落到传入顺序兜底。
  const orderedIds = useMemo(() => {
    const set = new Set(shotIds)
    const out: string[] = []
    for (const ep of project.episodes)
      for (const scId of ep.sceneIds)
        for (const shId of project.scenes[scId]?.shotIds ?? []) if (set.has(shId)) out.push(shId)
    for (const id of shotIds) if (!out.includes(id)) out.push(id)
    return out
  }, [project, shotIds])

  const rows = orderedIds.map((id) => project.shots[id]).filter((sh): sh is NonNullable<typeof sh> => !!sh)

  const [selected, setSelected] = useState<Set<string>>(() => new Set(shotIds))
  const [mode, setMode] = useState<'smart' | 'concat'>('smart')
  const [expanded, setExpanded] = useState<string | null>(null)

  const total = rows.length
  const allOn = selected.size === total && total > 0
  const someOn = selected.size > 0 && !allOn
  const cost = selected.size * 2

  const allRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = someOn
  }, [someOn])

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const toggleAll = () => setSelected(allOn ? new Set() : new Set(orderedIds))

  return (
    <div className={d.overlay} onClick={onClose}>
      <div className={c.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={c.head}>
          <span className={c.title}>合成最终提示词</span>
          <button className={c.close} onClick={onClose} title="关闭">
            ×
          </button>
        </div>

        <div className={c.list}>
          {rows.map((shot, i) => (
            <div className={c.row} key={shot.id}>
              <div className={c.rowTop}>
                <label className={c.rowMain}>
                  <input type="checkbox" checked={selected.has(shot.id)} onChange={() => toggle(shot.id)} />
                  <span className={c.mno}>镜 {i + 1}</span>
                  <span className={c.mtitle}>{shot.title}</span>
                </label>
                <button
                  className={c.detail}
                  onClick={() => setExpanded((e) => (e === shot.id ? null : shot.id))}
                >
                  详情
                </button>
              </div>
              {expanded === shot.id && (
                <div className={c.preview}>{shot.imagePrompt || shot.sourceQuote || '—'}</div>
              )}
            </div>
          ))}
        </div>

        <div className={c.foot}>
          <label className={c.all}>
            <input ref={allRef} type="checkbox" checked={allOn} onChange={toggleAll} />
            全选镜头
          </label>
          <span className={c.count}>
            已选 {selected.size}/{total}
          </span>

          <div className={c.footRight}>
            <span className={c.model}>GVLM 3.1 ⌄</span>
            <div className={c.modes}>
              <label className={mode === 'smart' ? c.modeOn : ''}>
                <input type="radio" checked={mode === 'smart'} onChange={() => setMode('smart')} />
                智能合成
              </label>
              <label className={mode === 'concat' ? c.modeOn : ''}>
                <input type="radio" checked={mode === 'concat'} onChange={() => setMode('concat')} />
                自动拼接
              </label>
            </div>
            <span className={c.cost}>⚡ {cost}</span>
            <button
              className={[ui.btn, ui.btnPrimary].join(' ')}
              disabled={selected.size === 0}
              onClick={() => onConfirm([...selected])}
            >
              确认合成
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
