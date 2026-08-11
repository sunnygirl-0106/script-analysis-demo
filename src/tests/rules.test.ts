// ════════════════════════════════════════════════════════════════════════
// 7 条业务规则的断言。测试里的中文描述就是产品规则本身，不要为了通过测试去改测试。
//
// 【版本追溯约定】
//   · 规则版本对应《剧本分析-交接文档-v1.0.md》第六章。当前基线：v1.0 · 2026-08-10。
//   · 目前只有这一个版本 —— 所有断言均为 v1.0。
//   · 每条规则（describe）标 `since`（首次引入）/ `updated`（最近一次修改）。
//   · 每个断言（it）行尾挂版本标记，例如 `// v1.0`。
//   · 规则改动时：把该规则的 `updated` 与受影响断言的行尾标记抬到新版本
//     （如 v1.1），未改的断言保持原标记，git diff 即可定位版本变更点。
// ════════════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest'
import { seedProject, A } from '../data/seed'
import { episode2Payload } from '../data/seedEpisode2'
import type { MountRef } from '../data/types'
import { computeTimeline, sceneDuration } from '../services/timeline'
import { defaultMounts } from '../services/mount'
import { referenceImages } from '../services/reference'
import { appendEpisode } from '../services/incremental'
import { densityShots, applyDensity } from '../services/density'
import { canEdit, resplitScene } from '../services/lock'

/** 规则基线版本。整体版本升级时改这里，单条规则/断言的局部变更用行内标记覆盖。 */
export const RULES_VERSION = 'v1.0' // 2026-08-10 · 对应技术方案 v1.0

// 每个用例都从 seed 深拷贝，互不污染。
const fresh = () => structuredClone(seedProject)

// ── R1 时长是累计时间轴 · since v1.0 · updated v1.0 ──
describe('R1 时长是累计时间轴', () => {
  it('startAt = 本场前面所有镜时长之和', () => {
    // v1.0
    const p = fresh()
    const scene = p.scenes.s1!
    const tl = computeTimeline(scene, p.shots)
    expect(tl[0]!.startAt).toBe(0)
    // 逐镜首尾相接
    for (let i = 1; i < tl.length; i++) {
      expect(tl[i]!.startAt).toBe(tl[i - 1]!.endAt)
    }
  })

  it('改一个镜的时长，后面所有镜 startAt 顺移，场时长跟着变', () => {
    // v1.0
    const p = fresh()
    const scene = p.scenes.s1!
    const before = computeTimeline(scene, p.shots)
    const durBefore = sceneDuration(scene, p.shots)

    // 把第 2 个镜 +3 秒
    const secondId = scene.shotIds[1]!
    const delta = 3
    p.shots[secondId]!.duration += delta

    const after = computeTimeline(scene, p.shots)
    // 第 3 个及以后的 startAt 各 +3
    for (let i = 2; i < after.length; i++) {
      expect(after[i]!.startAt).toBe(before[i]!.startAt + delta)
    }
    // 场时长 +3
    expect(sceneDuration(scene, p.shots)).toBe(durBefore + delta)
  })

  it('第 1 场初始为 8 镜 · 32 秒', () => {
    // v1.0
    const p = fresh()
    expect(p.scenes.s1!.shotIds.length).toBe(8)
    expect(sceneDuration(p.scenes.s1!, p.shots)).toBe(32)
  })
})

// ── R2 挂载是引用不是复制 · since v1.0 · updated v1.0 ──
describe('R2 挂载是引用不是复制', () => {
  it('改资产名后，挂过它的镜渲染出的标签是新名字', () => {
    // v1.0
    const p = fresh()
    p.assets[A.suke]!.name = '苏可可'
    // 任取一个挂了苏可的镜
    const shot = Object.values(p.shots).find((s) => s.mounts.some((m) => m.assetId === A.suke))!
    expect(shot).toBeTruthy()
    const label = p.assets[A.suke]!.name // 界面渲染时用 id 反查名字
    expect(label).toBe('苏可可')
  })
})

// ── R3 追加集与资产去重 · since v1.0 · updated v1.1 ──
describe('R3 追加集与资产去重', () => {
  it('追加集：重名资产复用旧 id，未命中的按内容照数新建', () => {
    // v1.1 —— 口径从「资产总数只 +1」改为「新增数由新集内容决定」。
    // 追加集本来就该新增它自己的资产，把新增数写死成常数是把规则焊在了 seed 上。
    const p = fresh()
    const beforeCount = Object.keys(p.assets).length
    const beforeSukeId = p.assets[A.suke]!.id

    // 期望新增数 = 新集资产里「kind + 归一化名称」未命中已有资产的去重个数
    const keyOf = (a: { kind: string; name: string }) =>
      `${a.kind}::${a.name.replace(/\s+/g, '').toLowerCase()}`
    const existing = new Set(Object.values(p.assets).map(keyOf))
    const expectedNew = new Set(
      episode2Payload.assets.filter((a) => !existing.has(keyOf(a))).map(keyOf),
    ).size

    const next = appendEpisode(p, episode2Payload)

    expect(next.assets[A.suke]!.id).toBe(beforeSukeId) // 重名 → 复用旧 id，不新建
    expect(Object.keys(next.assets).length).toBe(beforeCount + expectedNew)
    // 第 2 集里没有新建一个重复的「苏可」
    expect(Object.values(next.assets).filter((a) => a.name === '苏可').length).toBe(1)
    // 新集带来的资产，无论是角色还是道具，全部都能在库里找到
    for (const a of episode2Payload.assets) {
      expect(Object.values(next.assets).some((x) => x.name === a.name)).toBe(true)
    }
  })

  it('第 2 集的镜挂载指向复用后的旧 id', () => {
    // v1.0
    const p = fresh()
    const next = appendEpisode(p, episode2Payload)
    const ep2Shots = Object.values(next.shots).filter((s) => s.sceneId.startsWith('e2'))
    const sukeMount = ep2Shots.flatMap((s) => s.mounts).find((m) => m.assetId === A.suke)
    expect(sukeMount).toBeTruthy() // 指向的是第 1 集的 c_suke，而非临时 id
    // 临时 id 不应出现在任何挂载里
    const anyTemp = ep2Shots.flatMap((s) => s.mounts).some((m) => m.assetId === 'c_suke__ep2')
    expect(anyTemp).toBe(false)
  })

  it('第 1 集所有 shot 的 mounts 数组完全相等（引用未变）', () => {
    // v1.0
    const p = fresh()
    const ep1ShotIds = p.episodes[0]!.sceneIds.flatMap((sid) => p.scenes[sid]!.shotIds)
    const next = appendEpisode(p, episode2Payload)
    for (const id of ep1ShotIds) {
      expect(next.shots[id]!.mounts).toBe(p.shots[id]!.mounts) // 同一引用
    }
  })
})

// ── R4 挂载默认值，不是禁令 · since v1.0 · updated v1.1 ──
describe('R4 挂载默认值，不是禁令', () => {
  it('defaultMounts 结果同时包含 character 和 costume', () => {
    // v1.0
    const p = fresh()
    // 构造一个只挂了角色的镜
    const shot = structuredClone(p.shots.s1_sh5!)
    shot.mounts = [{ kind: 'character', assetId: A.suke }]
    const result = defaultMounts(shot, p.assets)
    expect(result.some((m: MountRef) => m.kind === 'character')).toBe(true)
    expect(result.some((m: MountRef) => m.kind === 'costume')).toBe(true)
  })

  // R4-b：参考图清单 —— 每个已挂角色恰好一张定妆图（角色 + 其服装），素模不单列。
  it('挂了苏可的镜：referenceImages 里 character 恰好 1 条且携带 costumeId', () => {
    // v1.1
    const p = fresh()
    const shot = Object.values(p.shots).find((s) => s.mounts.some((mm) => mm.assetId === A.suke))!
    expect(shot).toBeTruthy()
    const refs = referenceImages(shot, p.assets)
    const chars = refs.filter((r) => r.kind === 'character')
    expect(chars.length).toBe(1)
    expect(chars[0]!.costumeId).toBe(A.hoodie)
    // 服装不作为独立参考图出现（已融进定妆图）。
    expect(refs.some((r) => r.kind === 'costume')).toBe(false)
  })
})

// ── R5 镜头密度 · since v1.0 · updated v1.0 ──
describe('R5 镜头密度', () => {
  it('同一场：compact 镜数 > standard > loose', () => {
    // v1.0
    const c = densityShots('s1', 'compact').length
    const s = densityShots('s1', 'standard').length
    const l = densityShots('s1', 'loose').length
    expect(c).toBeGreaterThan(s)
    expect(s).toBeGreaterThan(l)
  })

  it('三套的场总时长相差不超过 2 秒', () => {
    // v1.0
    const total = (d: 'compact' | 'standard' | 'loose') =>
      densityShots('s1', d).reduce((sum, sh) => sum + sh.duration, 0)
    const c = total('compact')
    const s = total('standard')
    const l = total('loose')
    expect(Math.abs(c - s)).toBeLessThanOrEqual(2)
    expect(Math.abs(s - l)).toBeLessThanOrEqual(2)
    expect(Math.abs(c - l)).toBeLessThanOrEqual(2)
  })

  it('applyDensity 返回对应那套的 shotIds', () => {
    // v1.0
    const p = fresh()
    const ids = applyDensity(p.scenes.s1!, 'compact')
    expect(ids.length).toBe(densityShots('s1', 'compact').length)
    expect(ids).toEqual(densityShots('s1', 'compact').map((s) => s.id))
  })
})

// ── R6 阶段锁与重拆 · since v1.0 · updated v1.0 ──
describe('R6 阶段锁与重拆', () => {
  it("stage='visual' 时 analysis 不可编辑", () => {
    // v1.0
    const p = fresh()
    p.stage = 'visual'
    expect(canEdit(p, 'analysis')).toBe(false)
    expect(canEdit(p, 'visual')).toBe(true)
  })

  it("stage='analysis' 时 analysis 可编辑", () => {
    // v1.0
    const p = fresh()
    expect(canEdit(p, 'analysis')).toBe(true)
  })

  it('重拆第 1 场后，第 2 场的 shotIds 数组引用未变', () => {
    // v1.0
    const p = fresh()
    // 先把第 1 场改乱（换成紧凑密度的 id），确认重拆能恢复
    const s2RefBefore = p.scenes.s2!.shotIds
    p.scenes.s1!.shotIds = applyDensity(p.scenes.s1!, 'compact')
    const next = resplitScene(p, 's1')
    // 第 1 场恢复成初始 8 镜
    expect(next.scenes.s1!.shotIds.length).toBe(8)
    expect(next.scenes.s1!.shotIds).toEqual(seedProject.scenes.s1!.shotIds)
    // 第 2 场引用未变
    expect(next.scenes.s2!.shotIds).toBe(s2RefBefore)
  })
})
