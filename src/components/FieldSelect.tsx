import { useRef, useState } from 'react'
import { useClickOutside } from '../hooks/useClickOutside'
import ui from '../styles/ui.module.css'
import s from './FieldSelect.module.css'

interface Props {
  label: string
  value: string
  options: readonly string[]
  readOnly?: boolean
  onChange: (v: string) => void
}

// 灰度可编辑字段：点开下拉，选完表面立刻变。只读时不显示下拉箭头。
export function FieldSelect({ label, value, options, readOnly, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false), open)

  if (readOnly) {
    return (
      <span className={[ui.field, ui.fieldRo].join(' ')}>
        <span className={ui.fkey}>{label}</span>
        {value}
      </span>
    )
  }

  return (
    <div className={s.wrap} ref={ref}>
      <span className={ui.field} onClick={() => setOpen((o) => !o)}>
        <span className={ui.fkey}>{label}</span>
        {value}
      </span>
      {open && (
        <div className={s.menu}>
          {options.map((opt) => (
            <div
              key={opt}
              className={[s.opt, opt === value ? s.on : ''].join(' ')}
              onClick={() => {
                onChange(opt)
                setOpen(false)
              }}
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
