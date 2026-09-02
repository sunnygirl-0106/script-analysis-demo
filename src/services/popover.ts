// 浮层定位。纯函数，只算坐标，不碰 DOM、不管事件。
//
// 全仓库有 5 处浮层各自手写了同一套「量 rect → 夹进视口 → 放不下就换个方向」，
// 边距 8、间隙 5/6 这些数字也各写各的。两种落位策略其实只有两条：
//   · flip   —— 优先贴锚点下方，下方放不下就翻到锚点上方（下拉、联想框）
//   · clamp  —— 从锚点处向下展开，放不下就整体上移贴住视口底（就地编辑弹层，
//                它要盖住原格子，翻到上方会让人找不到自己在改哪一格）

/** 浮层与视口边缘至少留这么多。 */
const MARGIN = 8

export interface Rect {
  top: number
  bottom: number
  left: number
}

export interface Placement {
  top: number
  left: number
}

/** 左右夹进视口。dx 是相对锚点左缘的偏移。 */
function clampLeft(anchorLeft: number, width: number, dx: number): number {
  return Math.max(MARGIN, Math.min(anchorLeft + dx, window.innerWidth - width - MARGIN))
}

/**
 * 贴锚点**下方**；下方放不下就翻到锚点上方。
 * 用于下拉菜单、@ 联想、挂载选择这类「不该盖住锚点」的浮层。
 */
export function placeFlip(
  anchor: Rect,
  size: { w: number; h: number },
  opts: { gap?: number; dx?: number } = {},
): Placement {
  const gap = opts.gap ?? 6
  let top = anchor.bottom + gap
  if (top + size.h > window.innerHeight - MARGIN) {
    top = Math.max(MARGIN, anchor.top - size.h - gap)
  }
  return { top, left: clampLeft(anchor.left, size.w, opts.dx ?? 0) }
}

/**
 * 从锚点处向下展开；放不下就整体上移贴住视口底，**不翻转**。
 * 用于就地编辑弹层：它要盖在原格子上，翻到上方反而让人找不到在改哪一格。
 */
export function placeClamp(
  anchor: Rect,
  size: { w: number; h: number },
  opts: { dy?: number; dx?: number } = {},
): Placement {
  let top = anchor.top + (opts.dy ?? 0)
  if (top + size.h > window.innerHeight - MARGIN) {
    top = Math.max(MARGIN, window.innerHeight - size.h - MARGIN)
  }
  return { top, left: clampLeft(anchor.left, size.w, opts.dx ?? 0) }
}

/** 只把一个已定好的左上角夹进视口（右键菜单那类，位置由鼠标决定）。 */
export function clampToViewport(x: number, y: number, size: { w: number; h: number }): Placement {
  return {
    left: Math.min(x, window.innerWidth - size.w - MARGIN),
    top: Math.min(y, window.innerHeight - size.h - MARGIN),
  }
}
