import { useMemo, useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import type { AssetKind, MountRef } from '../data/types'
import { useClickOutside } from '../hooks/useClickOutside'
import { KIND_LABEL } from './entity'
import ui from '../styles/ui.module.css'
import s from './MountPicker.module.css'

interface Props {
  shotId: string
  kinds: AssetKind[]
  mounts: MountRef[]
  disabled?: boolean
}

// 挂载弹层：可搜索、可勾选、可取消。挂载存 id，即引用。
export function MountPicker({ shotId, kinds, mounts, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false), open)

  const assets = useStore((st) => st.project.assets)
  const addMount = useStore((st) => st.addMount)
  const removeMount = useStore((st) => st.removeMount)

  const mountedIds = useMemo(() => new Set(mounts.map((m) => m.assetId)), [mounts])
  const options = useMemo(
    () =>
      Object.values(assets)
        .filter((a) => kinds.includes(a.kind))
        .filter((a) => a.name.includes(q.trim())),
    [assets, kinds, q],
  )

  if (disabled) return null

  return (
    <div className={s.wrap} ref={ref}>
      <span
        className={[ui.chip, ui.chipAdd].join(' ')}
        onClick={() => setOpen((o) => !o)}
        title="添加挂载"
      >
        +
      </span>
      {open && (
        <div className={s.pop}>
          <input
            className={s.search}
            placeholder="搜索资产…"
            value={q}
            autoFocus
            onChange={(e) => setQ(e.target.value)}
          />
          <div className={s.list}>
            {options.length === 0 && <div className={s.empty}>没有匹配的资产</div>}
            {options.map((a) => {
              const on = mountedIds.has(a.id)
              return (
                <div
                  key={a.id}
                  className={s.opt}
                  onClick={() =>
                    on ? removeMount(shotId, a.id) : addMount(shotId, { kind: a.kind, assetId: a.id })
                  }
                >
                  <span className={[s.check, on ? s.on : ''].join(' ')}>{on ? '✓' : ''}</span>
                  {a.name}
                  <span className={s.kindTag}>{KIND_LABEL[a.kind]}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
