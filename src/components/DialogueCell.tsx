import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store/useStore'
import { placeClamp, placeFlip } from '../services/popover'
import type { Look } from '../data/types'
import { armEditSwallow, consumeEditSwallow } from '../services/editGuard'
import {
  parseDialogue,
  serializeDialogue,
  textHint,
  usedSpeakers,
  type DlgLine,
} from '../services/dialogue'
import s from './DialogueCell.module.css'

// 对白 · 旁白：结构化行内编辑。类型（台词 / 旁白）+ 说话人 + 内容。
// 字符串 ↔ 结构化行的编解码在 services/dialogue.ts，本组件只管交互。

const TIP_OTHER =
  '用于标注无法关联至具体角色的声音，如广播或系统播报。该信息不创建角色资产，也不参与角色形象生成。'

const POP_W = 500
const POP_MAX_H = 360
const SPK_W = 240
const TIP_W = 244
const SPK_MAX_H = 240

interface Props {
  shotId: string
  value: string
  readOnly: boolean
}

export function DialogueCell({ shotId, value, readOnly }: Props) {
  const update = useStore((st) => st.updateShotField)
  const assets = useStore((st) => st.project.assets)
  const shots = useStore((st) => st.project.shots)
  const mounts = shots[shotId]?.mounts

  const [open, setOpen] = useState(false)
  const [lines, setLines] = useState<DlgLine[]>(() => parseDialogue(value))
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const spkRef = useRef<HTMLDivElement>(null)

  // 说话人：menuIdx = 打开下拉的行；freeIdx = 正在行内自填的行。两者互斥。
  const [menuIdx, setMenuIdx] = useState<number | null>(null)
  const [freeIdx, setFreeIdx] = useState<number | null>(null)
  const [spkPos, setSpkPos] = useState<{ top: number; left: number } | null>(null)
  // 问号说明：portal 浮层，定位到问号右下方，避免内联撑高滚动容器导致的闪烁。
  const [tipPos, setTipPos] = useState<{ top: number; left: number } | null>(null)
  // 已主动选「其他声音来源」的行（会话级）：留空时按钮显示「未选择声音来源」而非默认提示。
  const [otherEmpty, setOtherEmpty] = useState<Set<number>>(() => new Set())

  // 本镜画面中的角色：由挂载派生（着装角色取其角色本体，character 兜底直接取）。
  const shotRoles = useMemo(() => {
    const out: string[] = []
    for (const m of mounts ?? []) {
      const a = assets[m.assetId]
      if (!a) continue
      const name =
        a.kind === 'look'
          ? assets[(a as Look).characterId]?.name
          : a.kind === 'character'
            ? a.name
            : undefined
      if (name && !out.includes(name)) out.push(name)
    }
    return out
  }, [mounts, assets])

  // 全剧角色名（下拉列表 + 判定「画外」+ 联想）。
  const allChars = useMemo(
    () => Object.values(assets).filter((a) => a.kind === 'character').map((a) => a.name),
    [assets],
  )

  // 说话人下拉：全剧已识别角色，本镜画面内的排在前、其余（画外）在后。未在画面中的角色也可直接选择。
  const menuChars = useMemo(
    () => [...shotRoles, ...allChars.filter((n) => !shotRoles.includes(n))],
    [shotRoles, allChars],
  )

  // 全剧对白里用过的自定义声音来源（联想候选，不是角色资产）。
  // 全剧自填过的说话人（排掉角色名）。全剧扫描由 usedSpeakers 记忆化，所有格子共用一次。
  const usedFree = useMemo(
    () => usedSpeakers(shots).filter((n) => !allChars.includes(n)),
    [shots, allChars],
  )

  const isChar = (n: string) => allChars.includes(n)
  /** 只读派生：说话人恰好是某角色、且不在本镜画面中 → 画外。 */
  const isOff = (n: string) => isChar(n) && !shotRoles.includes(n)

  useEffect(() => {
    if (open) {
      setLines(parseDialogue(value))
      setOtherEmpty(new Set())
    }
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

  const closeSpeaker = () => {
    setMenuIdx(null)
    setFreeIdx(null)
    setTipPos(null)
  }

  // 点在触发器、主弹层与说话人浮层之外 → 收起。
  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      const t = e.target as Node
      if (wrapRef.current?.contains(t)) return
      if (popRef.current?.contains(t)) return
      if (spkRef.current?.contains(t)) return
      armEditSwallow()
      setOpen(false)
      closeSpeaker()
    }
    const id = window.setTimeout(() => document.addEventListener('mousedown', handle), 0)
    return () => {
      window.clearTimeout(id)
      document.removeEventListener('mousedown', handle)
    }
  }, [open])

  // 说话人下拉打开时：点在它之外（但仍在主弹层内）→ 只收下拉；滚动同样收起，避免浮层跟不住触发器。
  useEffect(() => {
    if (menuIdx === null && freeIdx === null) return
    function handle(e: MouseEvent) {
      const t = e.target as Node
      if (spkRef.current?.contains(t)) return
      if ((t as HTMLElement).closest?.('[data-spkbtn]')) return
      if ((t as HTMLElement).closest?.('[data-spkfree]')) return
      closeSpeaker()
    }
    const onScroll = () => closeSpeaker()
    const id = window.setTimeout(() => document.addEventListener('mousedown', handle), 0)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.clearTimeout(id)
      document.removeEventListener('mousedown', handle)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [menuIdx, freeIdx])

  // 就地覆盖单元格展开（自单元格顶沿起，与「光影氛围」等文本格一致），而非落在整行下方。
  // 空间不够时贴视口底 clamp；优先用弹窗实测高度定位，首帧退回估值 POP_MAX_H，挂载后本效果再校正一次。
  const place = () => {
    const el = wrapRef.current
    if (!el) return
    const h = popRef.current?.offsetHeight || POP_MAX_H
    const { top, left } = placeClamp(el.getBoundingClientRect(), { w: POP_W, h }, { dy: -4, dx: -4 })
    setPos((p) => (p && p.top === top && p.left === left ? p : { top, left }))
  }

  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // 弹窗挂载 / 内容行数变化后，用真实高度再定位一次（首帧 pos 只有估值高度）。
  // place() 用稳定 setter：高度收敛后返回同一引用、不再触发本效果，不会自循环。
  useLayoutEffect(() => {
    if (open && pos) place()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pos, lines.length])

  const placeSpk = (r: DOMRect) => {
    setSpkPos(placeFlip(r, { w: SPK_W, h: SPK_MAX_H }, { gap: 5 }))
  }

  // 问号说明：定位到问号的右下方（右缘对齐问号），portal 到 body，不占下拉布局故不闪。
  const openTipAt = (el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    setTipPos({ top: r.bottom + 8, left: Math.max(8, Math.min(r.right - TIP_W, window.innerWidth - TIP_W - 8)) })
  }

  // 自填态：定位联想浮层到输入框下方，并聚焦输入框。
  useLayoutEffect(() => {
    if (freeIdx === null) return
    const el = popRef.current?.querySelector<HTMLInputElement>('[data-spkfree="1"]')
    if (!el) return
    placeSpk(el.getBoundingClientRect())
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freeIdx])

  const display = parseDialogue(value)

  // 联想候选：全剧角色（不在本镜的）+ 已用过的自定义来源，按输入过滤。
  const suggestions = (() => {
    if (freeIdx === null) return []
    const q = (lines[freeIdx]?.speaker ?? '').trim()
    if (!q) return []
    const pool = [...allChars.filter((n) => !shotRoles.includes(n)), ...usedFree]
    return [...new Set(pool)].filter((n) => n.includes(q) && n !== q).slice(0, 6)
  })()

  const chooseOther = (i: number) => {
    // 「其他」= 不是列表里的角色：当前若是本镜角色则清空；已是自填内容则保留以便继续编辑。
    if (shotRoles.includes(lines[i]?.speaker ?? '')) {
      patch((d) => {
        d[i].speaker = ''
        return d
      })
    }
    setOtherEmpty((s) => new Set(s).add(i))
    setMenuIdx(null)
    setTipPos(null)
    setFreeIdx(i)
  }

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
              {l.type === '台词' && l.speaker && (
                <>
                  <b className={[s.spk, isChar(l.speaker) ? '' : s.spkFree].join(' ')}>{l.speaker}</b>
                  {isOff(l.speaker) && (
                    <span className={s.offMark} title="该角色不在本镜画面中，系统自动标注为画外">
                      画外
                    </span>
                  )}
                  <b className={[s.spk, isChar(l.speaker) ? '' : s.spkFree].join(' ')}>：</b>
                </>
              )}
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
            <div className={s.head}>对白 · 旁白</div>

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

                      {l.type === '台词' &&
                        (freeIdx === i ? (
                          <input
                            className={s.spkInput}
                            data-spkfree="1"
                            value={l.speaker}
                            spellCheck={false}
                            autoComplete="off"
                            placeholder="填写声音来源，如「画外人声」「广播」「系统播报」"
                            onChange={(e) =>
                              patch((d) => {
                                d[i].speaker = e.target.value
                                return d
                              })
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                if (suggestions[0]) {
                                  patch((d) => {
                                    d[i].speaker = suggestions[0]!
                                    return d
                                  })
                                }
                                setFreeIdx(null)
                              } else if (e.key === 'Escape') {
                                e.stopPropagation()
                                setFreeIdx(null)
                              }
                            }}
                            onBlur={(e) => {
                              // 点联想项时不要抢先收起
                              if (spkRef.current?.contains(e.relatedTarget as Node)) return
                              setFreeIdx(null)
                            }}
                          />
                        ) : (
                          <button
                            className={[s.spkBtn, l.speaker ? '' : s.spkBtnBlank].join(' ')}
                            data-spkbtn="1"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (menuIdx === i) {
                                closeSpeaker()
                                return
                              }
                              setFreeIdx(null)
                              setTipPos(null)
                              setMenuIdx(i)
                              placeSpk(e.currentTarget.getBoundingClientRect())
                            }}
                            title="选择说话人"
                          >
                            <span>{l.speaker || (otherEmpty.has(i) ? '未选择声音来源' : '选择说话人或声音来源')}</span>
                            <i>▾</i>
                          </button>
                        ))}

                      <button
                        className={s.del}
                        title="删除这一句"
                        onClick={() => {
                          closeSpeaker()
                          patch((d) => d.filter((_, j) => j !== i))
                          // 删行后索引整体前移，重映射标记集合。
                          setOtherEmpty((s) => {
                            const next = new Set<number>()
                            for (const idx of s) {
                              if (idx < i) next.add(idx)
                              else if (idx > i) next.add(idx - 1)
                            }
                            return next
                          })
                        }}
                      >
                        ✕
                      </button>
                    </div>
                    <textarea
                      className={s.textarea}
                      rows={2}
                      value={l.text}
                      spellCheck={false}
                      placeholder={textHint(l)}
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
                onClick={() => {
                  closeSpeaker()
                  patch((d) => [...d, { type: '台词', speaker: shotRoles[0] ?? '', text: '' }])
                }}
              >
                ＋ 台词
              </button>
              <button
                className={s.addBtn}
                onClick={() => {
                  closeSpeaker()
                  patch((d) => [...d, { type: '旁白', speaker: '', text: '' }])
                }}
              >
                ＋ 旁白
              </button>
            </div>

            <div className={s.foot}>说话人可留空；未填写时仅保留台词内容 · 自动保存</div>
          </div>,
          document.body,
        )}

      {/* 说话人浮层：menuIdx 时是下拉，freeIdx 时是联想。两者互斥，共用一个浮层。 */}
      {open &&
        spkPos &&
        (menuIdx !== null || suggestions.length > 0) &&
        createPortal(
          <div
            className={s.spkPop}
            ref={spkRef}
            style={{ top: spkPos.top, left: spkPos.left, width: SPK_W }}
            onClick={(e) => e.stopPropagation()}
          >
            {menuIdx !== null ? (
              <>
                {menuChars.map((n) => {
                  const on = lines[menuIdx]?.speaker === n
                  return (
                    <div
                      key={n}
                      className={[s.spkOpt, on ? s.spkOptOn : ''].join(' ')}
                      onClick={() => {
                        const i = menuIdx
                        closeSpeaker()
                        patch((d) => {
                          d[i].speaker = n
                          return d
                        })
                        setOtherEmpty((s) => {
                          if (!s.has(i)) return s
                          const next = new Set(s)
                          next.delete(i)
                          return next
                        })
                      }}
                    >
                      <span className={s.spkDot} />
                      {n}
                      {on && <span className={s.spkTail}>当前</span>}
                    </div>
                  )
                })}
                {menuChars.length > 0 && <div className={s.spkSep} />}
                <div className={[s.spkOpt, s.spkOptAct, s.spkOptOther].join(' ')} onClick={() => chooseOther(menuIdx)}>
                  <span className={[s.spkDot, s.spkDotOther].join(' ')} />
                  <span className={s.spkOtherText}>
                    <span className={s.spkOtherTitle}>其他声音来源</span>
                    <span className={s.spkOtherDesc}>无法对应到具体角色的声音</span>
                  </span>
                  <span
                    className={s.qm}
                    onMouseEnter={(e) => openTipAt(e.currentTarget)}
                    onMouseLeave={() => setTipPos(null)}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (tipPos) setTipPos(null)
                      else openTipAt(e.currentTarget)
                    }}
                  >
                    ?
                  </span>
                </div>
              </>
            ) : (
              suggestions.map((n) => (
                <div
                  key={n}
                  className={s.spkOpt}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    const i = freeIdx!
                    patch((d) => {
                      d[i].speaker = n
                      return d
                    })
                    setFreeIdx(null)
                  }}
                >
                  <span className={[s.spkDot, isChar(n) ? '' : s.spkDotOther].join(' ')} />
                  {n}
                </div>
              ))
            )}
          </div>,
          document.body,
        )}

      {/* 问号说明浮层：portal 到 body，定位到问号右下方，不占下拉布局。 */}
      {open &&
        tipPos &&
        menuIdx !== null &&
        createPortal(
          <div
            className={s.tip}
            style={{ top: tipPos.top, left: tipPos.left, width: TIP_W }}
            onClick={(e) => e.stopPropagation()}
          >
            {TIP_OTHER}
          </div>,
          document.body,
        )}
    </div>
  )
}
