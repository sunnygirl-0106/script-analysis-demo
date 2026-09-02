import { useEffect, useRef, type ReactNode } from 'react'
import d from '../styles/dialog.module.css'

// 弹窗公共壳。此前 9 个弹窗各抄一份：遮罩 5 份定义（z-index 与背景已经开始发散）、
// ESC 监听逐字抄了 3 份而另外 6 个压根没有、焦点管理一处都没有。
// 这里收成一处，顺带把「ESC 能关」和「关掉后焦点回到原处」补齐到全部弹窗。
//
// 不做的事：不管布局、不管标题栏。各弹窗内部长什么样差别很大，
// 强行抽成 title/actions 插槽只会逼出一堆 override。这里只管**壳的行为**。
export function Dialog({
  onClose,
  dismissible = true,
  className,
  labelledBy,
  children,
}: {
  onClose: () => void
  /** false = 点遮罩与按 ESC 都不关。任务跑到一半时用，避免中途关窗留下半截状态。 */
  dismissible?: boolean
  /** 弹窗容器的 class。不传则用公共 .dialog。 */
  className?: string
  /** 标题元素的 id，供读屏播报。 */
  labelledBy?: string
  children: ReactNode
}) {
  const boxRef = useRef<HTMLDivElement>(null)

  // ESC 关闭。dismissible 变化时重新绑定，所以跑任务期间按 ESC 不会漏关。
  useEffect(() => {
    if (!dismissible) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dismissible, onClose])

  // 焦点：进来时若弹窗内没有任何东西被聚焦（有的弹窗自己会 focus 输入框），
  // 就把焦点放到容器上；关掉后还给打开它的那个元素。
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    const box = boxRef.current
    if (box && !box.contains(document.activeElement)) box.focus()
    return () => prev?.focus?.()
  }, [])

  // Tab 循环限制在弹窗内，否则焦点会跑到背后那一整页上去。
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return
    const box = boxRef.current
    if (!box) return
    const items = box.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
    )
    if (items.length === 0) return
    const first = items[0]!
    const last = items[items.length - 1]!
    if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    } else if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    }
  }

  return (
    <div className={d.overlay} onClick={dismissible ? onClose : undefined}>
      <div
        ref={boxRef}
        className={className ?? d.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        {children}
      </div>
    </div>
  )
}
