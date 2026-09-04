// 断言对应《改动方案-v1.3.md》§1.2 / §6.5。中文描述即产品规则。
import { describe, it, expect } from 'vitest'
import { seedProject } from '../data/seed'
import type { PromptState } from '../data/types'
import { shotIdsOfScope, defaultSelection, groupByScene } from '../services/promptScope'

const fresh = () => structuredClone(seedProject)

// 自然序参照：集 → 场 → 镜。
const allInOrder = (p = fresh()) =>
  p.episodes.flatMap((ep) => ep.sceneIds.flatMap((sid) => p.scenes[sid]!.shotIds))

describe('R14 生成范围求解与默认勾选', () => {
  it('scope=scene 只含当前场，且顺序与场内一致', () => {
    const p = fresh()
    expect(shotIdsOfScope(p, 'scene', 's1')).toEqual(p.scenes.s1!.shotIds)
    expect(shotIdsOfScope(p, 'scene', 's1').length).toBe(8)
  })

  it('scope=episode 覆盖当前集全部场，按集→场→镜排列', () => {
    const p = fresh()
    const ep1Shots = p.episodes[0]!.sceneIds.flatMap((sid) => p.scenes[sid]!.shotIds)
    expect(shotIdsOfScope(p, 'episode', 's1')).toEqual(ep1Shots)
  })

  it('scope=project 覆盖全剧全部镜头，顺序为集→场→镜', () => {
    const p = fresh()
    expect(shotIdsOfScope(p, 'project', 's1')).toEqual(allInOrder(p))
    expect(shotIdsOfScope(p, 'project', 's1').length).toBe(30)
  })

  it('defaultSelection：pending / stale 勾选，ready / generating 不勾选', () => {
    const ids = ['a', 'b', 'c', 'd']
    const states: Record<string, PromptState> = {
      a: 'pending',
      b: 'stale',
      c: 'ready',
      d: 'generating',
    }
    const sel = defaultSelection(ids, states)
    expect(sel.has('a')).toBe(true)
    expect(sel.has('b')).toBe(true)
    expect(sel.has('c')).toBe(false)
    expect(sel.has('d')).toBe(false)
    expect(sel.size).toBe(2)
  })

  it('defaultSelection：无状态项按 pending 处理，默认勾选', () => {
    const sel = defaultSelection(['x'], {})
    expect(sel.has('x')).toBe(true)
  })

  it('groupByScene：分组数 = 有镜头的场数，每组镜数与场内一致', () => {
    const p = fresh()
    const ids = shotIdsOfScope(p, 'project', 's1')
    const groups = groupByScene(p, ids)
    expect(groups.length).toBe(5) // 第 1 集三场 + 第 2 集两场
    expect(groups.map((g) => g.sceneId)).toEqual(['s1', 's2', 's3', 'e2s1', 'e2s2'])
    expect(groups[0]!.shotIds.length).toBe(8)
    const summed = groups.reduce((n, g) => n + g.shotIds.length, 0)
    expect(summed).toBe(30)
  })

  it('groupByScene：只保留含入参镜头的场（scene 范围只出一组）', () => {
    const p = fresh()
    const ids = shotIdsOfScope(p, 'scene', 's2')
    const groups = groupByScene(p, ids)
    expect(groups.length).toBe(1)
    expect(groups[0]!.sceneId).toBe('s2')
    expect(groups[0]!.sceneNo).toBe(2)
  })
})
