import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store/useStore'
import type { Asset, AssetKind, MountRef } from '../data/types'
import { KIND_COLOR, KIND_LABEL, KIND_ORDER } from './entity'
import s from './MountPicker.module.css'

interface Props {
  shotId: string
  mounts: MountRef[]
  disabled?: boolean
  kinds?: AssetKind[]
}

// 每个资产右侧的说明文字：角色→戏份，服装→归属角色，场景→时段。
function noteOf(a: Asset, assets: Record<string, Asset>): string {
  if (a.kind === 'character') return a.role === 'lead' ? '主角' : a.role === 'support' ? '配角' : '龙套'
  if (a.kind === 'costume') return assets[a.characterId]?.name ?? '通用'
  if (a.kind === 'location') return a.timeOfDay
  return ''
}

const POP_W = 300
const POP_MAX_H = 380

// 挂载弹层：单入口「挂载资产」，四类分组、可搜索、可勾选。挂载存 id，即引用。
//
// 弹层走 portal 挂到 body：分镜表的行是固定高度且 overflow 受限的网格单元，
// 绝对定位的弹层会被祖先裁掉，所以这里改用 fixed 定位 + 实时测算触发器位置。
export function MountPicker({ shotId, mounts, disabled, kinds = KIND_ORDER }: Props) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
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
    // 延后一帧绑定，避免触发打开的那次点击立刻又关掉
    const id = window.setTimeout(() => document.addEventListener('mousedown', handle), 0)
    return () => {
      window.clearTimeout(id)
      document.removeEventListener('mousedown', handle)
    }
  }, [open])

  // 定位：默认贴触发器下方，撞到视口下沿就翻到上方，右侧同理。
  // 滚动与缩放时重算（capture 才能收到内部滚动容器的事件）。
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
      if (top + POP_MAX_H > window.innerHeight - 8) {
        top = Math.max(8, r.top - POP_MAX_H - 6)
      }
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

  useEffect(() => {
    if (!open) setQ('')
  }, [open])

  const mountedIds = useMemo(() => new Set(mounts.map((m) => m.assetId)), [mounts])
  const groups = useMemo(() => {
    const query = q.trim()
    return kinds
      .map((kind) => ({
        kind,
        label: KIND_LABEL[kind],
        color: KIND_COLOR[kind],
        options: Object.values(assets).filter((a) => a.kind === kind && a.name.includes(query)),
      }))
      .filter((g) => g.options.length > 0)
  }, [assets, kinds, q])

  if (disabled) return null

  return (
    <div className={s.wrap} ref={wrapRef}>
      <button
        className={s.trigger}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        title="添加挂载"
      >
        <i className={s.plus}>+</i>
        挂载资产
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            className={s.pop}
            ref={popRef}
            style={{ top: pos.top, left: pos.left }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={s.searchBox}>
              <input
                className={s.search}
                placeholder="搜索角色 / 服装 / 场景 / 道具…"
                value={q}
                autoFocus
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className={s.list}>
              {groups.length === 0 && <div className={s.empty}>没有匹配的资产</div>}
              {groups.map((g) => (
                <div className={s.group} key={g.kind}>
                  <div className={s.groupLabel} style={{ color: g.color }}>
                    {g.label}
                  </div>
                  {g.options.map((a) => {
                    const on = mountedIds.has(a.id)
                    return (
                      <div
                        key={a.id}
                        className={[s.opt, on ? s.optOn : ''].join(' ')}
                        onClick={() =>
                          on ? removeMount(shotId, a.id) : addMount(shotId, { kind: a.kind, assetId: a.id })
                        }
                      >
                        <span className={[s.check, on ? s.checkOn : ''].join(' ')}>{on ? '✓' : ''}</span>
                        {a.name}
                        <span className={s.note}>{noteOf(a, assets)}</span>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
            <div className={s.foot}>勾选即挂载 · 引用不复制</div>
          </div>,
          document.body,
        )}
    </div>
  )
}
