// 悬停显形、停住几秒自动隐藏的浮层控制。用于「插入一场 / 一镜」这类热区：
// 鼠标进入或移动 = 有意图 → 显形并重新计时；停住不动到点 → 自动隐藏（避免不小心搁在这一直亮着）；
// 移出 → 立刻隐藏。isVisible() 读同步 ref，供 onClick 判定：隐藏状态下的点击不触发插入。
import { useCallback, useEffect, useRef, useState } from 'react'

export function useAutoHideHover(delay = 2500) {
  const [visible, setVisible] = useState(false)
  const vis = useRef(false)
  const timer = useRef<number | null>(null)

  const set = (v: boolean) => {
    vis.current = v
    setVisible(v) // 已是同值时 React 会跳过重渲染
  }
  const clear = () => {
    if (timer.current != null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
  }
  const arm = useCallback(() => {
    set(true)
    clear()
    timer.current = window.setTimeout(() => set(false), delay)
  }, [delay])
  const onMouseLeave = useCallback(() => {
    clear()
    set(false)
  }, [])
  const isVisible = useCallback(() => vis.current, [])

  useEffect(() => clear, [])

  return { visible, onMouseEnter: arm, onMouseMove: arm, onMouseLeave, isVisible }
}
