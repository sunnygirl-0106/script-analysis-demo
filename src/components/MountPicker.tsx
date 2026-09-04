import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store/useStore'
import { placeFlip } from '../services/popover'
import type { Asset, Look, MountableKind, MountRef } from '../data/types'
import { lookName } from '../services/looks'
import { KIND_COLOR, KIND_LABEL } from './entity'
import s from './MountPicker.module.css'
import { ic } from './icons'

// 「出场的人和物」每组末尾那颗「+」，以及它点开的挂载选择器。
//
// v2.8 §6 曾经把这个口整个撤掉，理由是「加人加物走主要内容里 @ 一下」。实际用下来不成立：
// @ 是**写正文顺带挂载**，它要求你先想好这句话怎么写；而这一列本身就是一份清单，
// 「这一镜里还该有个茶几」是照着清单补，跟正文没关系。两条路各有各的场合，都留着。
// 挂载仍然只认 look / location / prop（服装不参与挂载，决策 3b）。
//
// 弹层走 portal 挂到 body：分镜表的行是固定高度、overflow 受限的网格单元，
// 绝对定位的弹层会被祖先裁掉，所以用 fixed 定位 + 实时测算触发器位置。

const POP_W = 260
const POP_MAX_H = 340

/** 每条候选右侧的说明：着装角色 → 所属角色，场景 → 时段，道具无。 */
function noteOf(a: Asset, assets: Record<string, Asset>): string {
  if (a.kind === 'look') return assets[a.characterId]?.name ?? ''
  if (a.kind === 'location') return a.timeOfDay
  return ''
}

/** 列表里显示的名字。look.name 允许为空，必须走 lookName 兜底，否则是一行看不见的字。 */
function labelOf(a: Asset, assets: Record<string, Asset>): string {
  return a.kind === 'look' ? lookName(a as Look, assets) : a.name
}

export function MountPicker({
  shotId, mounts, kind,
}: {
  shotId: string
  mounts: MountRef[]
  /** 这颗「+」负责哪一类：角色组给 look，场景组给 location，道具组给 prop。 */
  kind: MountableKind
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const wrapRef = useRef<HTMLSpanElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  const assets = useStore((st) => st.project.assets)
  const addMount = useStore((st) => st.addMount)
  const removeMount = useStore((st) => st.removeMount)

  // 关闭：点在触发器与弹层之外。弹层在 portal 里，不能只判断 wrap.contains。
  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      const t = e.target as Node
      if (wrapRef.current?.contains(t)) return
      if (popRef.current?.contains(t)) return
      setOpen(false)
    }
    // 延后一帧绑定，避免触发打开的那次点击立刻又关掉。
    const id = window.setTimeout(() => document.addEventListener('mousedown', handle), 0)
    return () => {
      window.clearTimeout(id)
      document.removeEventListener('mousedown', handle)
    }
  }, [open])

  // ESC 关闭。
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open])

  // 定位：默认贴触发器下方，撞到视口下沿就翻到上方。滚动与缩放时重算
  //（capture 才能收到内部滚动容器的事件）。
  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      setQ('')
      return
    }
    const place = () => {
      const el = wrapRef.current
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
  }, [open])

  const mountedIds = useMemo(() => new Set(mounts.map((m) => m.assetId)), [mounts])
  const options = useMemo(() => {
    const query = q.trim()
    return Object.values(assets)
      .filter((a) => a.kind === kind)
      .map((a) => ({ asset: a, label: labelOf(a, assets), note: noteOf(a, assets) }))
      .filter((o) => query === '' || o.label.includes(query) || o.note.includes(query))
  }, [assets, kind, q])

  // 组名跟「出场的人和物」对齐：look 那一组在表里叫「角色」。
  const label = kind === 'look' ? KIND_LABEL.character : KIND_LABEL[kind]

  return (
    // data-mount-open 供分镜行的 .addSlot 用：弹层开着时鼠标多半已经移出这一行，
    // 「+」不能跟着淡出——那看起来像是这个弹层没有出处。
    <span className={s.wrap} ref={wrapRef} data-mount-open={open ? '' : undefined}>
      <button
        className={[s.addBtn, open ? s.addBtnOn : ''].join(' ')}
        title={`添加${label}`}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
      >
        +
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            className={s.pop}
            ref={popRef}
            style={{ top: pos.top, left: pos.left, width: POP_W }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={s.searchBox}>
              <input
                className={s.search}
                placeholder={`搜索${label}…`}
                value={q}
                autoFocus
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className={s.list}>
              <div className={s.groupLabel} style={{ color: KIND_COLOR[kind] }}>{label}</div>
              {options.length === 0 && <div className={s.empty}>没有找到相关{label}</div>}
              {options.map((o) => {
                const on = mountedIds.has(o.asset.id)
                return (
                  <div
                    key={o.asset.id}
                    className={[s.opt, on ? s.optOn : ''].join(' ')}
                    onClick={() =>
                      on
                        ? removeMount(shotId, o.asset.id)
                        : addMount(shotId, { kind, assetId: o.asset.id })
                    }
                  >
                    <span className={[s.check, on ? s.checkOn : ''].join(' ')}>{on ? ic.check : null}</span>
                    <span className={s.optName}>{o.label}</span>
                    {o.note && <span className={s.note}>{o.note}</span>}
                  </div>
                )
              })}
            </div>
            <div className={s.foot}>点一下加进本镜，再点一下移除</div>
          </div>,
          document.body,
        )}
    </span>
  )
}
