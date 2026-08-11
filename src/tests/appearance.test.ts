// C5 出场位置摘要工具的数据校验（展示工具函数，不是业务规则，独立于 rules.test.ts）。
import { describe, it, expect } from 'vitest'
import type { Appearance } from '../data/types'
import { summarizeAppearances } from '../services/appearance'

const ap = (episodeNo: number, sceneNo: number): Appearance => ({ episodeNo, sceneNo })

describe('summarizeAppearances', () => {
  it('单集三场：episodeCount 1 / sceneCount 3 / groups[0].label === "1·2·3"', () => {
    const r = summarizeAppearances([ap(1, 1), ap(1, 2), ap(1, 3)])
    expect(r.episodeCount).toBe(1)
    expect(r.sceneCount).toBe(3)
    expect(r.groups[0]!.label).toBe('1·2·3')
  })

  it('连续压缩：场号 1,2,3,4,5,8 → "1–5·8"', () => {
    const r = summarizeAppearances([1, 2, 3, 4, 5, 8].map((n) => ap(3, n)))
    expect(r.groups[0]!.label).toBe('1–5·8')
  })

  it('跨集分组：混合输入按 episodeNo 升序分组，组内场号升序', () => {
    const r = summarizeAppearances([ap(2, 4), ap(1, 3), ap(2, 1), ap(1, 1)])
    expect(r.groups.map((g) => g.episodeNo)).toEqual([1, 2])
    expect(r.groups[0]!.label).toBe('1·3')
    expect(r.groups[1]!.label).toBe('1·4')
  })
})
