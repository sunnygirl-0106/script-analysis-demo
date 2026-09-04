import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store/useStore'
import { placeFlip } from '../services/popover'
import type { Asset, Look, MountableKind } from '../data/types'
import { KIND_COLOR, KIND_LABEL, MOUNT_KINDS } from './entity'
import { lookName } from '../services/looks'
import s from './AtMentionPicker.module.css'

// 挂在受控 <textarea> 上的「@ 引用选择器」。
//
// 挂的类目与「出场的人和物」完全一致（MOUNT_KINDS = 角色造型 / 场景 / 道具）——
// **角色必须是「角色造型」（look），不允许裸角色**，跟挂载选择器同一口径。
// 选中即：① 把资产名插进正文 ② addMount 自动挂到该镜。
//
// 但正文里写的是角色名（buildTerms 排除 look），所以角色造型这一项：
//   显示 = 造型名「苏可 · 卫衣」，插入正文 = 角色名「苏可」（才会被 splitMentions 识别、
//   经 relatedAssetIds 一跳点亮这张造型卡），挂载 = 该 look。
const AT_KINDS: MountableKind[] = MOUNT_KINDS

// 一条候选：挂哪个资产、列表里显示什么、右侧说明、以及「插进正文的那个名字」。
interface Entry {
  asset: Asset
  /** 挂载用的类目（look / location / prop） */
  kind: MountableKind
  label: string
  note: string
  /** 落进正文的文字：角色造型落角色名，其余落自身名 */
  insertName: string
}

const POP_W = 280
const POP_MAX_H = 340

interface Props {
  /** 被监听的 textarea 元素 ref（父级已有的那个）。 */
  textareaRef: { current: HTMLTextAreaElement | HTMLInputElement | null }
  /** textarea 当前值（受控）。 */
  value: string
  /** 替换后的新值回写给父级。 */
  onChange: (next: string) => void
  /** 选中后自动挂载到哪一镜。 */
  shotId: string
}

interface Active {
  /** '@' 的下标 */
  at: number
  /** 光标下标（'@' 之后到此为 query） */
  caret: number
  query: string
}

export function AtMentionPicker({ textareaRef, value, onChange, shotId }: Props) {
  const assets = useStore((st) => st.project.assets)
  const addMount = useStore((st) => st.addMount)

  const [active, setActive] = useState<Active | null>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const popRef = useRef<HTMLDivElement>(null)

  // 从 textarea 的当前值 + 光标，解析出光标前最近的 @token（遇空白/换行/再一个 @ 即止）。
  const scan = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    const caret = el.selectionStart ?? el.value.length
    const before = el.value.slice(0, caret)
    const m = /@([^\s@]*)$/.exec(before)
    if (!m) {
      setActive(null)
      return
    }
    setActive({ at: caret - m[0]!.length, caret, query: m[1] ?? '' })
  }, [textareaRef])

  // 值变了就重扫（父级受控 value 驱动），保证与外部编辑同步。
  useEffect(() => {
    scan()
  }, [value, scan])

  // 光标移动 / 点击 / 键抬起也要重扫（移动光标离开 token 应收起）。
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    const on = () => scan()
    el.addEventListener('keyup', on)
    el.addEventListener('click', on)
    el.addEventListener('select', on)
    return () => {
      el.removeEventListener('keyup', on)
      el.removeEventListener('click', on)
      el.removeEventListener('select', on)
    }
  }, [textareaRef, scan])

  // Escape 收起（不影响父级的 Escape 语义：这里只吞掉选择器打开时的那一下）。
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setActive(null)
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [active])

  // 点选择器之外收起（选择器在 portal 里；点 textarea 不算外部，交给 scan 处理）。
  useEffect(() => {
    if (!active) return
    function handle(e: MouseEvent) {
      const t = e.target as Node
      if (popRef.current?.contains(t)) return
      if (textareaRef.current?.contains(t)) return
      setActive(null)
    }
    const id = window.setTimeout(() => document.addEventListener('mousedown', handle), 0)
    return () => {
      window.clearTimeout(id)
      document.removeEventListener('mousedown', handle)
    }
  }, [active, textareaRef])

  // 定位：贴 textarea 下方，撞到视口下沿翻到上方。
  useLayoutEffect(() => {
    if (!active) {
      setPos(null)
      return
    }
    const place = () => {
      const el = textareaRef.current
      if (!el) return
      setPos(placeFlip(el.getBoundingClientRect(), { w: POP_W, h: POP_MAX_H }))
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [active, textareaRef])

  const groups = useMemo(() => {
    const q = active?.query.trim() ?? ''
    const entryOf = (a: Asset): Entry => {
      if (a.kind === 'look') {
        const chName = assets[(a as Look).characterId]?.name ?? a.name
        // 走 lookName 而不是裸 a.name：look.name 允许为空（决策 5b 的兜底就在那儿），
        // 直接拿 a.name 当标签，空名的造型在列表里就是一行看不见的字。
        return { asset: a, kind: 'look', label: lookName(a as Look, assets), note: chName, insertName: chName }
      }
      if (a.kind === 'location') {
        // 场景不显示「日/内」时段标签：@ 框只需名字，时段是另一维度信息，这里是噪音。
        return { asset: a, kind: 'location', label: a.name, note: '', insertName: a.name }
      }
      return { asset: a, kind: 'prop', label: a.name, note: '', insertName: a.name }
    }
    const hit = (e: Entry) =>
      q === '' ||
      e.insertName.includes(q) ||
      e.label.includes(q) ||
      (e.asset.aliases ?? []).some((x) => x.includes(q))
    return AT_KINDS.map((kind) => ({
      kind,
      // 角色造型这一组直接叫「角色」，与「出场的人和物」的组名对齐。
      label: kind === 'look' ? KIND_LABEL.character : KIND_LABEL[kind],
      color: KIND_COLOR[kind],
      options: Object.values(assets)
        .filter((a) => a.kind === kind)
        .map(entryOf)
        .filter(hit),
    })).filter((g) => g.options.length > 0)
  }, [assets, active?.query])

  if (!active || !pos) return null

  const pick = (e: Entry) => {
    const cur = active
    // 用最新的 textarea 值兜底（受控 value 一般一致，DOM 值更保险）。
    const el = textareaRef.current
    const text = el?.value ?? value
    const next = text.slice(0, cur.at) + e.insertName + text.slice(cur.caret)
    const caret = cur.at + e.insertName.length
    onChange(next)
    addMount(shotId, { kind: e.kind, assetId: e.asset.id })
    setActive(null)
    requestAnimationFrame(() => {
      const n = textareaRef.current
      if (n) {
        n.focus()
        n.setSelectionRange(caret, caret)
      }
    })
  }

  return createPortal(
    <div
      className={s.pop}
      ref={popRef}
      data-atmention-pop=""
      style={{ top: pos.top, left: pos.left, width: POP_W }}
      onMouseDown={(e) => e.preventDefault() /* 别让 textarea 失焦 */}
    >
      <div className={s.list}>
        {groups.length === 0 && <div className={s.empty}>没有找到相关资产</div>}
        {groups.map((g) => (
          <div className={s.group} key={g.kind}>
            <div className={s.groupLabel} style={{ color: g.color }}>
              {g.label}
            </div>
            {g.options.map((e) => (
              <div key={e.asset.id} className={s.opt} onClick={() => pick(e)}>
                {e.label}
                <span className={s.note}>{e.note}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className={s.foot}>选中即插入正文并挂到本镜</div>
    </div>,
    document.body,
  )
}
