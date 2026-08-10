// 弹层关闭用，手写 20 行，不引库。
import { useEffect, type RefObject } from 'react'

export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  onOutside: () => void,
  active = true,
) {
  useEffect(() => {
    if (!active) return
    function handle(e: MouseEvent) {
      const el = ref.current
      if (el && !el.contains(e.target as Node)) onOutside()
    }
    // 延后一帧绑定，避免触发打开的那次点击立刻又关掉
    const id = window.setTimeout(() => document.addEventListener('mousedown', handle), 0)
    return () => {
      window.clearTimeout(id)
      document.removeEventListener('mousedown', handle)
    }
  }, [ref, onOutside, active])
}
