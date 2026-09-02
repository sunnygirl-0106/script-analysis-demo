import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store/useStore'
import { placeFlip } from '../services/popover'
import type { Asset, MountableKind, MountRef } from '../data/types'
import { KIND_COLOR, KIND_LABEL, MOUNT_KINDS } from './entity'
import s from './MountPicker.module.css'

interface Props {
  shotId: string
  mounts: MountRef[]
  disabled?: boolean
  kinds?: MountableKind[]
  // 'add' = 只画一颗虚线「+」圆钮（分组内按类目追加）；默认是「挂载资产」文字按钮。
  variant?: 'default' | 'add'
}

// 每个资产右侧的说明文字：着装角色→所属角色，场景→时段。服装不参与挂载（决策 3b）。
function noteOf(a: Asset, assets: Record<string, Asset>): string {
  if (a.kind === 'character') return a.role === 'lead' ? '主角' : a.role === 'support' ? '配角' : '龙套'
  if (a.kind === 'look') return assets[a.characterId]?.name ?? ''
  if (a.kind === 'location') return a.timeOfDay
  return ''
}

const POP_W = 300
const POP_MAX_H = 380

// 挂载弹层：单入口「挂载资产」，四类分组、可搜索、可勾选。挂载存 id，即引用。
//
// 弹层走 portal 挂到 body：分镜表的行是固定高度且 overflow 受限的网格单元，
// 绝对定位的弹层会被祖先裁掉，所以这里改用 fixed 定位 + 实时测算触发器位置。
export function MountPicker({ shotId, mounts, disabled, kinds = MOUNT_KINDS, variant = 'default' }: Props) {
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

  // 单类目时，按钮标题与搜索占位随该类目走（分组内的「+」）。
  const single = kinds.length === 1 ? KIND_LABEL[kinds[0]!] : null
  const addTitle = single ? `添加${single}` : '添加内容'

  return (
    <div className={s.wrap} ref={wrapRef}>
      {variant === 'add' ? (
        <button
          className={s.addBtn}
          onClick={(e) => {
            e.stopPropagation()
            setOpen((o) => !o)
          }}
          title={addTitle}
        >
          +
        </button>
      ) : (
        <button
          className={s.trigger}
          onClick={(e) => {
            e.stopPropagation()
            setOpen((o) => !o)
          }}
          title={addTitle}
        >
          <i className={s.plus}>+</i>
          添加到镜头
        </button>
      )}
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
                placeholder={single ? `搜索${single}…` : '搜索角色造型、场景或道具…'}
                value={q}
                autoFocus
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className={s.list}>
              {groups.length === 0 && <div className={s.empty}>没有找到相关内容</div>}
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
                          on ? removeMount(shotId, a.id) : addMount(shotId, { kind: g.kind, assetId: a.id })
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
            <div className={s.foot}>选择后会添加到当前镜头</div>
          </div>,
          document.body,
        )}
    </div>
  )
}
