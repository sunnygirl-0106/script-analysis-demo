// 关闭就地编辑弹层的那一次点击，不应顺带打开下一个格子的编辑。
// dismiss（mousedown 命中弹层之外）时置位，由紧接着的那次 click 消费；
// 若这次 click 没落在可编辑格上，也会在同一次 click 结束时兜底清除，避免残留误伤后续点击。
let swallow = false

/** 弹层被点外部关闭时调用：吞掉紧接着的那一次「打开编辑」。 */
export function armEditSwallow() {
  swallow = true
  document.addEventListener('click', () => { swallow = false }, { once: true })
}

/** 可编辑格 onClick 里调用：返回 true 表示本次点击应被吞掉（只关闭、不打开）。 */
export function consumeEditSwallow(): boolean {
  if (!swallow) return false
  swallow = false
  return true
}
