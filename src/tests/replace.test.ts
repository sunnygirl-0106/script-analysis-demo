// R8 替换本集资产 diff · since v1.3 · updated v1.3
// 断言对应《改动方案-v1.3.md》§1.3 / §3.7。reused / added / removed 的口径。
import { describe, it, expect } from 'vitest'
import { seedProject, A } from '../data/seed'
import { episode2Payload } from '../data/seedEpisode2'
import { appendEpisode } from '../services/incremental'
import { deleteEpisode } from '../services/lock'
import { episodeReplaceDiff } from '../services/replace'

const fresh = () => structuredClone(seedProject)

describe('R8 替换本集资产 diff', () => {
  it('同名资产计入 reused 而非 added（苏可只算一次沿用）', () => {
    // v1.3 —— next = 追加第 2 集后的项目，旧资产悉数保留。
    const prev = fresh()
    const next = appendEpisode(fresh(), episode2Payload)
    const diff = episodeReplaceDiff(prev, next)

    // 旧资产全部仍在 next → 全部沿用，无一被误记为新增。
    expect(diff.reused).toBe(Object.keys(prev.assets).length)
    expect(diff.removed).toBe(0)
    // 新增 = next 比 prev 多出来的资产（第 2 集去重后的净新增）。
    expect(diff.added).toBe(Object.keys(next.assets).length - Object.keys(prev.assets).length)
    // 苏可两集同名，只贡献一份 reused，绝不进 removed。
    expect(diff.removedNames).not.toContain('苏可')
  })

  it('仅在被替换集出现、新内容中不存在的资产计入 removed', () => {
    // v1.3 —— prev 含第 2 集，next 删掉第 2 集后其独有资产（快递员 / 退货包裹）应被移除。
    const prev = appendEpisode(fresh(), episode2Payload)
    const next = deleteEpisode(prev, 'e2')
    const diff = episodeReplaceDiff(prev, next)

    expect(diff.removedNames).toContain('快递员')
    expect(diff.removedNames).toContain('退货包裹')
    expect(diff.removed).toBe(diff.removedNames.length)
    expect(diff.added).toBe(0)
  })

  it('其他集仍在引用的资产不计入 removed（苏可跨集，保留）', () => {
    // v1.3
    const prev = appendEpisode(fresh(), episode2Payload)
    const next = deleteEpisode(prev, 'e2')
    const diff = episodeReplaceDiff(prev, next)

    expect(next.assets[A.suke]).toBeTruthy()
    expect(diff.removedNames).not.toContain('苏可')
    expect(next.assets[A.living]).toBeTruthy()
    expect(diff.removedNames).not.toContain('客厅')
  })
})
