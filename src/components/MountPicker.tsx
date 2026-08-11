import { useMemo, useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import type { Asset, AssetKind, MountRef } from '../data/types'
import { useClickOutside } from '../hooks/useClickOutside'
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

// 挂载弹层：单入口「挂载资产」，四类分组、可搜索、可勾选。挂载存 id，即引用。
export function MountPicker({ shotId, mounts, disabled, kinds = KIND_ORDER }: Props) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false), open)

  const assets = useStore((st) => st.project.assets)
  const addMount = useStore((st) => st.addMount)
  const removeMount = useStore((st) => st.removeMount)

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
    <div className={s.wrap} ref={ref}>
      <button className={s.trigger} onClick={() => setOpen((o) => !o)} title="添加挂载">
        <i className={s.plus}>+</i>
        挂载资产
      </button>
      {open && (
        <div className={s.pop}>
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
        </div>
      )}
    </div>
  )
}
