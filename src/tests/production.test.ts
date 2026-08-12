// 两批资产生产 + 单向影响的断言。规则版本 v1.2（2026-08-12 · 资产页改造）。
//
// 最关键的正确性：Look 排除在第一批之外；上游改提示词只让下游过期，不被下游反向覆盖；
// 提示词修改永不改变 Look 的角色—服装引用。
import { describe, it, expect, beforeEach } from 'vitest'
import { seedProject, A } from '../data/seed'
import type { Look } from '../data/types'
import {
  firstBatchAssets,
  affectedLooks,
  isProductionStale,
  staleProductionItems,
  isScriptStale,
} from '../services/production'
import { useStore } from '../store/useStore'

const reset = () => useStore.setState({ project: structuredClone(seedProject), producedIds: [] })
const proj = () => useStore.getState().project

beforeEach(reset)

describe('第一批资产生产', () => {
  it('第一批含角色 / 服装 / 场景 / 道具四类，不含着装角色', () => {
    const base = firstBatchAssets(proj())
    const kinds = new Set(base.map((a) => a.kind))
    expect(kinds.has('character')).toBe(true)
    expect(kinds.has('costume')).toBe(true)
    expect(kinds.has('location')).toBe(true)
    expect(kinds.has('prop')).toBe(true)
    // 第一批不含着装角色：基础资产数 = 全部非 look 资产数。
    const nonLook = Object.values(proj().assets).filter((a) => a.kind !== 'look').length
    expect(base.length).toBe(nonLook)
  })

  it('startAssetProduction 后 snapshot 固定当时提示词与 revision，且不含 Look', () => {
    useStore.getState().startAssetProduction()
    const p = proj()
    const snap = p.productionSnapshot!
    expect(snap).toBeTruthy()
    expect(snap.items.some((it) => p.assets[it.sourceAssetId]?.kind === 'look')).toBe(false)
    const sukeItem = snap.items.find((it) => it.sourceAssetId === A.suke)!
    expect(sukeItem.prompt).toBe(seedProject.assets[A.suke]!.imagePrompt)
    expect(sukeItem.sourceRevision).toBe(1)
    // 进入生产后推进到 visual。
    expect(p.stage).toBe('visual')
  })
})

describe('单向影响：上游改，下游过期', () => {
  it('生产后改角色提示词：snapshot 不被回写，资产 stale，依赖 Look 被标记失效', () => {
    useStore.getState().startAssetProduction()
    const snapPromptBefore = proj().productionSnapshot!.items.find((it) => it.sourceAssetId === A.suke)!.prompt

    useStore.getState().updateAssetPrompt(A.suke, '改后的角色提示词')
    const p = proj()

    // snapshot 未被回写（下游副本不随上游变）。
    const snapPromptAfter = p.productionSnapshot!.items.find((it) => it.sourceAssetId === A.suke)!.prompt
    expect(snapPromptAfter).toBe(snapPromptBefore)
    expect(snapPromptAfter).not.toBe('改后的角色提示词')

    // 资产自身 stale。
    expect(isProductionStale(p.assets[A.suke]!)).toBe(true)
    expect(staleProductionItems(p)).toContain(A.suke)

    // 依赖它的着装角色被抬 revision（失效标记），但提示词与关系不变。
    const look = p.assets[A.lookSuke] as Look
    expect(look.revision).toBeGreaterThan(1)
    expect(look.characterId).toBe(A.suke)
    expect(look.costumeId).toBe(A.hoodie)
  })

  it('改服装提示词同样使依赖它的 Look 失效', () => {
    const cosRevBefore = proj().assets[A.hoodie]!.revision
    const lookRevBefore = (proj().assets[A.lookSuke] as Look).revision
    useStore.getState().updateAssetPrompt(A.hoodie, '改后的服装提示词')
    const p = proj()
    expect(p.assets[A.hoodie]!.revision).toBe(cosRevBefore + 1)
    expect((p.assets[A.lookSuke] as Look).revision).toBe(lookRevBefore + 1)
  })

  it('改 Look 提示词只抬自身 revision，不牵连角色 / 服装', () => {
    const charRev = proj().assets[A.suke]!.revision
    const cosRev = proj().assets[A.hoodie]!.revision
    useStore.getState().updateAssetPrompt(A.lookSuke, '只改自己')
    const p = proj()
    expect((p.assets[A.lookSuke] as Look).revision).toBe(2)
    expect(p.assets[A.suke]!.revision).toBe(charRev)
    expect(p.assets[A.hoodie]!.revision).toBe(cosRev)
  })

  it('改场景 / 道具提示词只使自身 stale，不牵连任何 Look', () => {
    useStore.getState().startAssetProduction()
    useStore.getState().updateAssetPrompt(A.living, '改后的场景提示词')
    useStore.getState().updateAssetPrompt(A.phone, '改后的道具提示词')
    const p = proj()
    expect(isProductionStale(p.assets[A.living]!)).toBe(true)
    expect(isProductionStale(p.assets[A.phone]!)).toBe(true)
    expect(affectedLooks(A.living, p.assets)).toEqual([])
    expect(affectedLooks(A.phone, p.assets)).toEqual([])
  })

  it('affectedLooks：角色 / 服装 → 引用它的 Look；场景 / 道具 → 空', () => {
    const assets = proj().assets
    expect(affectedLooks(A.suke, assets)).toContain(A.lookSuke)
    expect(affectedLooks(A.hoodie, assets)).toContain(A.lookSuke)
    expect(affectedLooks(A.living, assets)).toEqual([])
    expect(affectedLooks(A.phone, assets)).toEqual([])
  })

  it('快照是下游副本：改快照项不影响上游资产', () => {
    useStore.getState().startAssetProduction()
    const p = proj()
    const item = p.productionSnapshot!.items[0]!
    const srcId = item.sourceAssetId
    const upstreamBefore = p.assets[srcId]!.imagePrompt
    item.prompt = 'MUTATED'
    expect(p.assets[srcId]!.imagePrompt).toBe(upstreamBefore)
  })
})

describe('脚本修改与 Look 引用锁定', () => {
  it('脚本修改可更换镜头使用的着装角色，但不改 Look 内部的角色—服装引用', () => {
    const shotId = 's1_sh1'
    useStore.getState().removeMount(shotId, A.lookSuke)
    useStore.getState().addMount(shotId, { kind: 'look', assetId: A.lookDelivery })
    const p = proj()
    const mounts = p.shots[shotId]!.mounts
    expect(mounts.some((m) => m.assetId === A.lookDelivery)).toBe(true)
    expect(mounts.some((m) => m.assetId === A.lookSuke)).toBe(false)
    // Look 内部引用不因脚本改动而变。
    const look = p.assets[A.lookSuke] as Look
    expect(look.characterId).toBe(A.suke)
    expect(look.costumeId).toBe(A.hoodie)
  })

  it('脚本修改后 scriptRevision + 1；改资产提示词不动 scriptRevision', () => {
    const r0 = proj().scriptRevision
    useStore.getState().updateShotField('s1_sh1', 'title', '改标题')
    expect(proj().scriptRevision).toBe(r0 + 1)
    const r1 = proj().scriptRevision
    useStore.getState().updateAssetPrompt(A.suke, '改提示词')
    expect(proj().scriptRevision).toBe(r1)
  })

  it('生产后再改脚本：isScriptStale 为真（提示需重新同步）', () => {
    useStore.getState().startAssetProduction()
    expect(isScriptStale(proj())).toBe(false)
    useStore.getState().updateShotField('s1_sh1', 'title', '再改')
    expect(isScriptStale(proj())).toBe(true)
  })
})
