import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store/useStore'
import type { Shot } from '../data/types'
import { armEditSwallow, consumeEditSwallow } from '../services/editGuard'
import { EntityText } from './EntityText'
import { AtMentionPicker } from './AtMentionPicker'
import s from './ShotFieldCell.module.css'

// 分镜表里的行内可编辑字段格。点击就地弹出小弹窗（对齐设计稿）：
//  - variant 'pill'：枚举字段（景别 / 镜头设计），input + 「→」+ 预设，均按光标位置插入，失焦自动保存。
//  - variant 'text'：文本字段（主要内容 / 光影 / 音效），就地覆盖单元格的 textarea，失焦自动保存。
type FieldKey = Extract<keyof Shot, 'shotSize' | 'cameraMove' | 'sourceQuote' | 'lighting' | 'dialogue' | 'sfx'>

interface Props {
  shotId: string
  field: FieldKey
  value: string
  readOnly: boolean
  variant: 'pill' | 'text'
  label: string
  hint?: string
  presets?: readonly string[]
  rows?: number
  clamp?: 2 | 3 | 4
  placeholder?: string
  /** 展示态把文中的资产名切成可 hover 的实体词（只「主要内容」开）。编辑态仍是纯 textarea。 */
  entities?: boolean
}

// pill 弹窗固定宽；text 弹窗贴合单元格宽度就地覆盖。
const PILL_POP_W = 288
const PILL_POP_H = 150
const TEXT_POP_H = 200

// 景别 / 镜头设计的行内展示：按「→」切段，命中预设的段落显示为胶囊，其余原样纯文本。
interface Tok {
  text: string
  kind: 'pill' | 'plain' | 'arrow'
}
function tokenize(value: string, presets: readonly string[]): Tok[] {
  const out: Tok[] = []
  const segs = value.split(/\s*(?:→|->)\s*/)
  segs.forEach((seg, i) => {
    const t = seg.trim()
    if (t) out.push({ text: t, kind: presets.includes(t) ? 'pill' : 'plain' })
    if (i < segs.length - 1) out.push({ text: '→', kind: 'arrow' })
  })
  return out
}

export function ShotFieldCell({
  shotId,
  field,
  value,
  readOnly,
  variant,
  label,
  presets,
  rows = 4,
  clamp = 3,
  placeholder = '待填写',
  entities = false,
}: Props) {
  const update = useStore((st) => st.updateShotField)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const inputEl = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)

  // 打开时以当前值初始化草稿
  useEffect(() => {
    if (open) setDraft(value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const commit = () => {
    if (draft !== value) update(shotId, field, draft)
  }

  // 关闭：点在触发器与弹层之外则保存并收起（弹层走 portal，需同时判断两个 ref）。
  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      const t = e.target as Node
      if (wrapRef.current?.contains(t)) return
      if (popRef.current?.contains(t)) return
      // @ 资产选择器走 portal，落在 popRef 之外——点它里面不算「点到外部」，否则选资产会误收编辑框。
      if ((e.target as HTMLElement).closest?.('[data-atmention-pop]')) return
      armEditSwallow()
      commit()
      setOpen(false)
    }
    const id = window.setTimeout(() => document.addEventListener('mousedown', handle), 0)
    return () => {
      window.clearTimeout(id)
      document.removeEventListener('mousedown', handle)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draft, value])

  // 就地定位：pill 贴触发器左上角、固定宽；text 覆盖单元格、贴合其宽度。撞视口边缘则回收。
  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    const place = () => {
      const el = wrapRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      if (variant === 'pill') {
        const width = PILL_POP_W
        const left = Math.max(8, Math.min(r.left + 6, window.innerWidth - width - 8))
        let top = r.top + 6
        if (top + PILL_POP_H > window.innerHeight - 8) top = Math.max(8, window.innerHeight - PILL_POP_H - 8)
        setPos({ top, left, width })
      } else {
        const width = Math.max(160, r.width - 8)
        const left = Math.max(8, Math.min(r.left + 4, window.innerWidth - width - 8))
        let top = r.top + 4
        if (top + TEXT_POP_H > window.innerHeight - 8) top = Math.max(8, window.innerHeight - TEXT_POP_H - 8)
        setPos({ top, left, width })
      }
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open, variant])

  useEffect(() => {
    if (open && pos && inputEl.current) {
      const node = inputEl.current
      node.focus()
      const len = node.value.length
      node.setSelectionRange(len, len)
    }
  }, [open, pos])

  // 按光标位置插入（预设词 / 「→」），插完把光标落到插入内容之后。
  const insertAtCursor = (text: string) => {
    const el = inputEl.current
    if (!el) {
      setDraft((d) => d + text)
      return
    }
    const a = el.selectionStart ?? draft.length
    const b = el.selectionEnd ?? a
    const next = draft.slice(0, a) + text + draft.slice(b)
    const caret = a + text.length
    setDraft(next)
    requestAnimationFrame(() => {
      const n = inputEl.current
      if (n) {
        n.focus()
        n.setSelectionRange(caret, caret)
      }
    })
  }

  const empty = !value.trim()
  // pill 变体（景别 / 镜头设计）整格内容居中；text 变体保持左对齐。
  const cellCls = [s.cell, variant === 'pill' ? s.cellPill : '', readOnly ? s.ro : s.editable, open ? s.cellOpen : ''].join(' ')

  return (
    <div
      className={cellCls}
      ref={wrapRef}
      onClick={() => {
        if (readOnly) return
        if (consumeEditSwallow()) return
        setOpen((o) => !o)
      }}
      title={readOnly ? undefined : `点击编辑${label}`}
    >
      {variant === 'pill' ? (
        empty ? (
          <span className={s.dim}>{placeholder}</span>
        ) : (
          <div className={s.toks}>
            {tokenize(value, presets ?? []).map((tk, i) =>
              tk.kind === 'pill' ? (
                <span key={i} className={s.pill}>
                  {tk.text}
                </span>
              ) : tk.kind === 'arrow' ? (
                <span key={i} className={s.tokArrow}>
                  →
                </span>
              ) : (
                <span key={i} className={s.tokPlain}>
                  {tk.text}
                </span>
              ),
            )}
          </div>
        )
      ) : empty ? (
        <span className={s.dim}>{placeholder}</span>
      ) : (
        <div className={clamp === 2 ? s.clamp2 : clamp === 4 ? s.clamp4 : s.clamp3}>
          {entities ? <EntityText text={value} shotId={shotId} /> : value}
        </div>
      )}

      {open &&
        pos &&
        createPortal(
          <div
            className={variant === 'pill' ? s.popPill : s.popText}
            ref={popRef}
            style={{ top: pos.top, left: pos.left, width: pos.width }}
            onClick={(e) => e.stopPropagation()}
          >
            {variant === 'pill' ? (
              <>
                <input
                  className={s.input}
                  ref={(el) => {
                    inputEl.current = el
                  }}
                  value={draft}
                  spellCheck={false}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      commit()
                      setOpen(false)
                    } else if (e.key === 'Escape') {
                      setOpen(false)
                    }
                  }}
                />
                <div className={s.picks}>
                  <button
                    className={s.arrowBtn}
                    title="在光标处插入 →（用于「中远景 → 中景」这类推拉）"
                    onClick={() => insertAtCursor(' → ')}
                  >
                    →
                  </button>
                  {(presets ?? []).map((p) => (
                    <button key={p} className={s.preset} onClick={() => insertAtCursor(p)}>
                      {p}
                    </button>
                  ))}
                </div>
                <div className={s.foot}>预设按光标位置填入，自动保存</div>
              </>
            ) : (
              <>
                <textarea
                  className={s.textarea}
                  ref={(el) => {
                    inputEl.current = el
                  }}
                  rows={rows}
                  value={draft}
                  spellCheck={false}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setOpen(false)
                  }}
                />
                {entities && (
                  <AtMentionPicker textareaRef={inputEl} value={draft} onChange={setDraft} shotId={shotId} />
                )}
                <div className={s.foot}>{entities ? '输入 @ 选择资产 · 自动保存' : '自动保存'}</div>
              </>
            )}
          </div>,
          document.body,
        )}
    </div>
  )
}
