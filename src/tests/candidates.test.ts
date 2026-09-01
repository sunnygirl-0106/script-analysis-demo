// R15 候选层：抽取去重 / 三选一结算 / 同名拦截 / 既有资产引用相等 · since v2.0
// 测试里的中文描述就是产品规则本身，不要为了通过测试去改测试。
import { describe, it, expect } from 'vitest'
import { seedProject, seedFreshProject, A } from '../data/seed'
import type { CandidateAsset, Look } from '../data/types'
import { extractCandidates, commitCandidates, nameConflict, type ScannedAsset } from '../services/candidates'

const fresh = () => structuredClone(seedProject)

describe('R15 候选抽取与入库', () => {
  it('① 抽取滤掉库里已有的同名同类，并在批内去重', () => {
    const p = fresh()
    const scanned: ScannedAsset[] = [
      { kind: 'character', name: '苏可' }, // 库里已有 → 滤掉
      { kind: 'prop', name: '新道具' },     // 新 → 保留
      { kind: 'prop', name: '新道具' },     // 批内重复 → 只留一条
      { kind: 'costume', name: '苏可' },    // 同名但不同类 → 保留
    ]
    const cands = extractCandidates(p, scanned)
    expect(cands.map((c) => `${c.kind}:${c.name}`).sort()).toEqual(['costume:苏可', 'prop:新道具'])
    expect(cands.every((c) => c.decision === 'new')).toBe(true)
  })

  it('② new 结算入库：promptRevision = 0，deliveredRevision 未定义', () => {
    const base = structuredClone(seedFreshProject)
    const cands: CandidateAsset[] = [
      { tempId: 'cand_prop_x', kind: 'prop', name: '道具X', imagePrompt: 'p', decision: 'new' },
    ]
    const { project, added } = commitCandidates(base, cands)
    expect(added).toHaveLength(1)
    const id = added[0]!
    expect(project.assets[id]!.promptRevision).toBe(0)
    expect(project.assets[id]!.deliveredRevision).toBeUndefined()
    expect(project.assets[id]!.name).toBe('道具X')
  })

  it('③ 角色候选带 costumeIds → 一并生成着装角色（look），characterId 指向刚入库的角色', () => {
    const base = structuredClone(seedFreshProject)
    const cands: CandidateAsset[] = [
      { tempId: 'cand_costume_c', kind: 'costume', name: '服装C', imagePrompt: '', decision: 'new' },
      { tempId: 'cand_character_a', kind: 'character', name: '角色A', imagePrompt: '', decision: 'new', costumeIds: ['cand_costume_c'] },
    ]
    const { project } = commitCandidates(base, cands)
    const charId = 'as_cand_character_a'
    const cosId = 'as_cand_costume_c'
    const look = Object.values(project.assets).find((a): a is Look => a.kind === 'look')
    expect(look).toBeTruthy()
    expect(look!.characterId).toBe(charId)
    expect(look!.costumeIds).toEqual([cosId])
  })

  it('④ 三选一：link 不新建只记引用，skip 什么都不做', () => {
    const base = structuredClone(seedFreshProject)
    const cands: CandidateAsset[] = [
      { tempId: 't_link', kind: 'prop', name: '关联项', imagePrompt: '', decision: 'link', linkTargetId: 'p_existing' },
      { tempId: 't_skip', kind: 'prop', name: '忽略项', imagePrompt: '', decision: 'skip' },
    ]
    const { project, added, linked, skipped } = commitCandidates(base, cands)
    expect(added).toEqual([])
    expect(linked).toEqual([{ tempId: 't_link', targetId: 'p_existing' }])
    expect(skipped).toEqual(['t_skip'])
    expect(Object.keys(project.assets)).toHaveLength(0)
  })

  it('⑤ 同名拦截：改名后与库内既有同类重名的 new 降级为 skip，不抛异常', () => {
    const p = fresh()
    const cand: CandidateAsset = { tempId: 't', kind: 'character', name: '苏可', imagePrompt: '', decision: 'new' }
    expect(nameConflict(p, cand)?.id).toBe(A.suke)
    const before = Object.keys(p.assets).length
    const { project, added, skipped } = commitCandidates(p, [cand])
    expect(added).toEqual([])
    expect(skipped).toEqual(['t'])
    expect(Object.keys(project.assets)).toHaveLength(before) // 库不变
  })

  it('⑥ 结算保持既有 assets 条目引用相等（记忆化不失效）', () => {
    const p = fresh()
    const cand: CandidateAsset = { tempId: 'cand_prop_z', kind: 'prop', name: '全新道具Z', imagePrompt: '', decision: 'new' }
    const { project } = commitCandidates(p, [cand])
    for (const id of Object.keys(p.assets)) {
      expect(project.assets[id]).toBe(p.assets[id])
    }
  })
})
