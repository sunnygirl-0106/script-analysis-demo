// 测试里的中文描述就是产品规则本身，不要为了通过测试去改测试。
import { describe, it, expect } from 'vitest'
import { seedProject, seedFreshProject, A } from '../data/seed'
import type { CandidateAsset, Look } from '../data/types'
import { extractCandidates, commitCandidates, nameConflict, type ScannedAsset } from '../services/candidates'
import { fillEpisode } from '../services/incremental'
import { episode3Payload, ep3Episode } from '../data/seedEpisode3'
import { useStore } from '../store/useStore'

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
    // 名字必须当场落定：空名会一路漏到 @ 引用选择器，「角色」一组每条都是空白。
    expect(look!.name).toBe('角色A · 服装C')
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

// 追加集（第 3 集）走的是「已入库之后的增量」这条路：没有三选一，AI 拆出什么就入什么。
// 这一组盯住那条最容易断的线——新角色带出来的**造型**。
// 角色候选是靠 `candidateTempId(kind, name)` 去引用同一批里那件服装候选的，
// 两边各算各的、约定不在类型里，改一处不改另一处 tsc 一声不响，
// 结果就是新角色在确认页上是个没有造型的光杆、入库后也没有 look 可挂。
describe('追加集：新角色必须带出至少一套造型', () => {
  const supplement = () => {
    const p = fresh()
    const cands = extractCandidates(p, useStore.getState().scannedForSupplement())
    return { p, cands }
  }

  it('① 房东带出一套造型，指向同一批里的服装候选', () => {
    const { cands } = supplement()
    const landlord = cands.find((c) => c.kind === 'character' && c.name === '房东')
    expect(landlord).toBeDefined()
    expect(landlord!.costumeIds).toHaveLength(1)

    // 指的必须是这一批里那件服装候选，不是一个悬空 id。
    const costumeId = landlord!.costumeIds![0]!
    const costume = cands.find((c) => c.tempId === costumeId)
    expect(costume?.name).toBe('碎花围裙')
    // 这套造型自带融合提示词，确认页上不是一行空白。
    expect(landlord!.lookPrompts?.[costumeId]).toContain('碎花围裙')
  })

  it('② 入库后造型带着它的融合提示词，不是一条空的', () => {
    const { p, cands } = supplement()
    const landlord = cands.find((c) => c.name === '房东')!
    const written = landlord.lookPrompts![landlord.costumeIds![0]!]!
    const { project } = commitCandidates(p, cands)
    const look = Object.values(project.assets).find(
      (a): a is Look => a.kind === 'look' && a.characterId === `as_${landlord.tempId}`,
    )
    // 阶段② 用户看过、还能改的那段话，必须原样进库 —— 丢了的话资产库里只剩一个「—」。
    expect(look!.imagePrompt).toBe(written)
  })

  it('③ 结算后角色 / 服装 / look 都入库，且 look 的绑定不悬空', () => {
    const { p, cands } = supplement()
    const { project } = commitCandidates(p, cands)
    const look = Object.values(project.assets).find(
      (a): a is Look => a.kind === 'look' && a.name === '房东 · 碎花围裙',
    )
    expect(look).toBeDefined()
    expect(project.assets[look!.characterId]?.name).toBe('房东')
    expect(look!.costumeIds.map((id) => project.assets[id]?.name)).toEqual(['碎花围裙'])
  })

  it('④ 第 3 集的镜头挂载能落到刚入库的那套造型上', () => {
    const { p, cands } = supplement()
    const { project } = commitCandidates(p, cands)
    const merged = fillEpisode(
      { ...project, episodes: [...project.episodes, { ...ep3Episode, sceneIds: [] }] },
      episode3Payload,
    )
    // 挂了 look 的镜头，其 look 挂载必须指向库里真实存在的 look。
    const lookMounts = Object.values(merged.shots)
      .flatMap((sh) => sh.mounts)
      .filter((m) => m.kind === 'look')
    expect(lookMounts.length).toBeGreaterThan(0)
    for (const m of lookMounts) {
      expect(merged.assets[m.assetId]?.kind).toBe('look')
    }
  })
})
