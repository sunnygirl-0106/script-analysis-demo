import { useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import s from './PanelResizer.module.css'

interface Props {
  // 拖拽起点读一次当前宽度。
  getWidth: () => number
  // 提交新宽度（夹取交给上层）。
  onResize: (width: number) => void
}

// 面板之间的竖向拖拽把手：把手左侧的面板随拖动增/减宽度，右侧大区自动吃剩余空间。
export function PanelResizer({ getWidth, onResize }: Props) {
  const start = useRef<{ x: number; w: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  const onDown = (e: ReactMouseEvent) => {
    e.preventDefault()
    start.current = { x: e.clientX, w: getWidth() }
    setDragging(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const move = (ev: globalThis.MouseEvent) => {
      if (!start.current) return
      onResize(start.current.w + (ev.clientX - start.current.x))
    }
    const up = () => {
      start.current = null
      setDragging(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  return (
    <div className={s.handle} onMouseDown={onDown} title="拖拽调整面板宽度">
      <span className={[s.line, dragging ? s.lineOn : ''].join(' ')} />
    </div>
  )
}
