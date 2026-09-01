// §7.4：把「原型里靠人点着核对的规则」变成 CI 里的自动断言。
// 同一份 DRILLS 供右下角速查面板（人点）与这里（CI 跑）。谁改了 deleteScene，lib:'same' 那条会直接红。
import { describe, it, expect } from 'vitest'
import { DRILLS, freshDrillStore } from '../services/drills'

describe.each(DRILLS)('$group · $op', (drill) => {
  it.each(drill.runs)('$label', (run) => {
    const api = freshDrillStore()
    run.arm?.(api)
    // 只度量 run 本身的效果：arm 可能已触发过闸，先复位痕迹。
    api.act.resetTrace()
    const before = api.snapshot()
    run.run(api)
    const after = api.snapshot()

    if (run.expect.lib === 'noloss') expect(after.lib).toBeGreaterThanOrEqual(before.lib)
    if (run.expect.lib === 'same') expect(after.lib).toBe(before.lib)
    if (run.expect.lib === 'minus') expect(after.lib).toBeLessThan(before.lib)

    expect(api.get().trace.sawIncrementalGate).toBe(run.expect.gate)
  })
})
