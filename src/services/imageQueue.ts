// R7 不生图开关。纯函数，供 VisualPrep 与测试共用。
// 规则版本：v1.0（2026-08-10）。断言见 tests/rules.test.ts 的 R7。
import type { Asset } from '../data/types'

/**
 * 生图队列 = 所有资产
 *   - skipImageGen === true 的角色
 *   - minor === true 的道具
 */
export function imageGenQueue(assets: Record<string, Asset>): Asset[] {
  return Object.values(assets).filter((a) => {
    if (a.kind === 'character' && a.skipImageGen) return false
    if (a.kind === 'prop' && a.minor) return false
    return true
  })
}
