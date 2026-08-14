import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store/useStore'
import { armEditSwallow, consumeEditSwallow } from '../services/editGuard'
import s from './DialogueCell.module.css'

// 对白 · 旁白：结构化行内编辑。类型（台词 / 旁白）+ 说话人（台词限本剧角色）+ 内容。
// 数据仍以字符串存在 shot.dialogue（不动数据模型），本组件负责解析 ↔ 序列化。

type DlgType = '台词' | '旁白'
interface DlgLine {
  type: DlgType
  speaker: string
  text: string
}

// 解析已有字符串为结构化行。尽量宽容：取 「」 内为正文，说话人取第一个 （ 或 ： 之前。
function parseDialogue(raw: string): DlgLine[] {
  const t = (raw ?? '').trim()
  if (!t || t === '无') return []
  return t
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map<DlgLine>((line) => {
      const isVo = /^(旁白|画外音?|独白|字幕)/.test(line)
      const q = line.match(/[「『](.*?)[」』]\s*$/)
      const text = q ? q[1] : line.replace(/^[^：:]*[：:]/, '').trim() || line
      if (isVo) return { type: '旁白', speaker: '', text }
      const sm = line.match(/^([^（(：:]+)/)
      return { type: '台词', speaker: sm ? sm[1].trim() : '', text }
    })
}

function serializeDialogue(lines: DlgLine[]): string {
  return lines
    .filter((l) => l.text.trim() || l.speaker.trim())
    .map((l) => (l.type === '旁白' ? `旁白：「${l.text}」` : `${l.speaker || '？'}：「${l.text}」`))
    .join('\n')
}

const POP_W = 400
const POP_MAX_H = 340

interface Props {
  shotId: string
  value: string
  readOnly: boolean
}

export function DialogueCell({ shotId, value, readOnly }: Props) {
  const update = useStore((st) => st.updateShotField)
  const assets = useStore((st) => st.project.assets)

  const [open, setOpen] = useState(false)
  const [lines, setLines] = useState<DlgLine[]>(() => parseDialogue(value))
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  // 说话人下拉：本剧解析出的角色 ∪ 现有台词里已出现的名字。
  const speakers = (() => {
    const chars = Object.values(assets)
      .filter((a) => a.kind === 'character')
      .map((a) => a.name)
    const extra = parseDialogue(value)
      .filter((l) => l.type === '台词' && l.speaker && !chars.includes(l.speaker))
      .map((l) => l.speaker)
    return [...chars, ...Array.from(new Set(extra))]
  })()

  useEffect(() => {
    if (open) setLines(parseDialogue(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const commit = (next: DlgLine[]) => {
    const serialized = serializeDialogue(next)
    if (serialized !== (value ?? '').trim()) update(shotId, 'dialogue', serialized)
  }

  const patch = (mut: (draft: DlgLine[]) => DlgLine[]) => {
    setLines((prev) => {
      const next = mut(prev.map((l) => ({ ...l })))
      commit(next)
      return next
    })
  }

  // 点在触发器与弹层之外 → 收起。
  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      const t = e.target as Node
      if (wrapRef.current?.contains(t)) return
      if (popRef.current?.contains(t)) return
      armEditSwallow()
      setOpen(false)
    }
    const id = window.setTimeout(() => document.addEventListener('mousedown', handle), 0)
    return () => {
      window.clearTimeout(id)
      document.removeEventListener('mousedown', handle)
    }
  }, [open])

  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    const place = () => {
      const el = wrapRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      let top = r.bottom + 6
      if (top + POP_MAX_H > window.innerHeight - 8) top = Math.max(8, r.top - POP_MAX_H - 6)
      const left = Math.max(8, Math.min(r.left, window.innerWidth - POP_W - 8))
      setPos({ top, left })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open])

  const display = parseDialogue(value)

  return (
    <div
      className={[s.cell, readOnly ? s.ro : s.editable, open ? s.cellOpen : ''].join(' ')}
      ref={wrapRef}
      onClick={() => {
        if (readOnly) return
        if (consumeEditSwallow()) return
        setOpen((o) => !o)
      }}
      title={readOnly ? undefined : '点击编辑对白 · 旁白'}
    >
      {display.length === 0 ? (
        <span className={s.dim}>无</span>
      ) : (
        display.map((l, i) => (
          <div className={s.line} key={i}>
            <span className={[s.type, l.type === '旁白' ? s.typeVo : ''].join(' ')}>{l.type}</span>
            <span className={s.text}>
              {l.type === '台词' && l.speaker && <b className={s.spk}>{l.speaker}：</b>}
              {l.text}
            </span>
          </div>
        ))
      )}

      {open &&
        pos &&
        createPortal(
          <div
            className={s.pop}
            ref={popRef}
            style={{ top: pos.top, left: pos.left, width: POP_W }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={s.head}>
              对白 · 旁白<span className={s.hint}>台词的说话人仅限本剧解析出的角色</span>
            </div>

            <div className={s.editList}>
              {lines.length === 0 ? (
                <div className={s.tiny} style={{ padding: '6px 2px' }}>
                  本镜暂无对白
                </div>
              ) : (
                lines.map((l, i) => (
                  <div className={s.item} key={i}>
                    <div className={s.itemHead}>
                      <span className={[s.type, l.type === '旁白' ? s.typeVo : ''].join(' ')}>{l.type}</span>
                      {l.type === '台词' && (
                        <select
                          className={s.select}
                          value={speakers.includes(l.speaker) ? l.speaker : ''}
                          onChange={(e) =>
                            patch((d) => {
                              d[i].speaker = e.target.value
                              return d
                            })
                          }
                        >
                          {!speakers.includes(l.speaker) && <option value="">选择说话人…</option>}
                          {speakers.map((sp) => (
                            <option key={sp} value={sp}>
                              {sp}
                            </option>
                          ))}
                        </select>
                      )}
                      <button
                        className={s.del}
                        title="删除这一句"
                        onClick={() => patch((d) => d.filter((_, j) => j !== i))}
                      >
                        ✕
                      </button>
                    </div>
                    <textarea
                      className={s.textarea}
                      rows={2}
                      value={l.text}
                      spellCheck={false}
                      placeholder={l.type === '旁白' ? '旁白内容…' : '台词内容…'}
                      onChange={(e) =>
                        patch((d) => {
                          d[i].text = e.target.value
                          return d
                        })
                      }
                    />
                  </div>
                ))
              )}
            </div>

            <div className={s.addRow}>
              <button
                className={s.addBtn}
                onClick={() => patch((d) => [...d, { type: '台词', speaker: speakers[0] ?? '', text: '' }])}
              >
                ＋ 台词
              </button>
              <button
                className={s.addBtn}
                onClick={() => patch((d) => [...d, { type: '旁白', speaker: '', text: '' }])}
              >
                ＋ 旁白
              </button>
            </div>

            <div className={s.poprow}>
              <span className={s.tiny}>新角色需先回「准备资产」新增</span>
              <span className={s.spacer} />
              <button className={s.done} onClick={() => setOpen(false)}>
                完成
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
