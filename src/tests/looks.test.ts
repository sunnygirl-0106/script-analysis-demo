// 着装角色（Look）关系与出场统计的断言。规则版本 v1.2（2026-08-12 · 资产页改造）。
import { describe, it, expect } from 'vitest'
import { seedProject, A } from '../data/seed'
import type { Look } from '../data/types'
import {
  allLooks,
  looksOfCharacter,
  looksUsingCostume,
  lookOfShot,
  isValidLook,
  lookCharacter,
  lookCostume,
  lookAppearances,
} from '../services/looks'
import { useStore } from '../store/useStore'

const fresh = () => structuredClone(seedProject)

describe('Look 关系', () => {
  it('每个 Look 都指向存在的角色与服装', () => {
    const p = fresh()
    const looks = allLooks(p.assets)
    expect(looks.length).toBeGreaterThan(0)
    for (const lk of looks) {
      expect(isValidLook(lk, p.assets), `「${lk.name}」关系无效`).toBe(true)
      expect(lookCharacter(lk, p.assets)?.kind).toBe('character')
      expect(lookCostume(lk, p.assets)?.kind).toBe('costume')
    }
  })

  it('一件服装可以被多个 Look 引用', () => {
    const p = fresh()
    // 造第二个引用同一件卫衣的着装角色（不同角色）。
    const extra: Look = {
      ...(p.assets[A.lookSuke] as Look),
      id: 'look_extra',
      name: '妈妈 · 宽松连帽卫衣',
      characterId: A.mom,
      costumeId: A.hoodie,
    }
    p.assets[extra.id] = extra
    const users = looksUsingCostume(A.hoodie, p.assets)
    expect(users.length).toBeGreaterThanOrEqual(2)
    expect(users.map((l) => l.id)).toContain(A.lookSuke)
    expect(users.map((l) => l.id)).toContain('look_extra')
  })

  it('一个角色可以有多个 Look', () => {
    const p = fresh()
    const extra: Look = {
      ...(p.assets[A.lookSuke] as Look),
      id: 'look_suke2',
      name: '苏可 · 骑手工装',
      costumeId: A.rider,
    }
    p.assets[extra.id] = extra
    const looks = looksOfCharacter(A.suke, p.assets)
    expect(looks.length).toBeGreaterThanOrEqual(2)
    expect(looks.map((l) => l.costumeId)).toContain(A.hoodie)
    expect(looks.map((l) => l.costumeId)).toContain(A.rider)
  })

  it('lookOfShot 返回本镜挂载的着装角色', () => {
    const p = fresh()
    const shot = p.shots.s1_sh1! // 挂了 lookSuke
    expect(lookOfShot(shot, p.assets).map((l) => l.id)).toContain(A.lookSuke)
  })

  it('Look 的出场摘要与挂载它的镜头场数一致', () => {
    const p = fresh()
    const scenesWithLook = new Set(
      Object.values(p.shots)
        .filter((sh) => sh.mounts.some((m) => m.assetId === A.lookSuke))
        .map((sh) => sh.sceneId),
    )
    const sum = lookAppearances(p.assets[A.lookSuke] as Look)
    expect(sum.sceneCount).toBe(scenesWithLook.size)
  })

  it('修改 Look 提示词只改 imagePrompt / revision，不动 characterId / costumeId', () => {
    useStore.setState({ project: fresh(), producedIds: [] })
    const before = useStore.getState().project.assets[A.lookSuke] as Look
    const beforeChar = before.characterId
    const beforeCos = before.costumeId
    const beforeRev = before.revision
    useStore.getState().updateAssetPrompt(A.lookSuke, '新的着装角色提示词')
    const after = useStore.getState().project.assets[A.lookSuke] as Look
    expect(after.imagePrompt).toBe('新的着装角色提示词')
    expect(after.revision).toBe(beforeRev + 1)
    expect(after.characterId).toBe(beforeChar)
    expect(after.costumeId).toBe(beforeCos)
  })
})
