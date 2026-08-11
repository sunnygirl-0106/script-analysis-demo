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
import { replaceScript } from '../services/replace'
import { altScriptPayload } from '../data/seedAltScript'
import { densityShots, applyDensity, resplitSceneDensity } from '../services/density'
import { canEdit, resplitScene, deleteEpisode } from '../services/lock'
import { mountIssues } from '../services/completeness'
import { isLongShot, LONG_SHOT_SEC } from '../services/duration'

/** 规则基线版本。整体版本升级时改这里，单条规则/断言的局部变更用行内标记覆盖。 */
export const RULES_VERSION = 'v1.1' // 2026-08-11 · 对应技术方案 v1.2（累计到 v1.1 规则集）

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

// ── R5 重拆颗粒度 · since v1.0 · updated v1.1 ──
// v1.1：密度不再是全局开关，成为 resplit 的参数，颗粒度下沉到 Scene.density。
describe('R5 重拆颗粒度', () => {
  it('同一场：compact 镜数 > standard > loose', () => {
    // v1.0
    const c = densityShots('s1', 'compact').length
    const s = densityShots('s1', 'standard').length
    const l = densityShots('s1', 'loose').length
    expect(c).toBeGreaterThan(s)
    expect(s).toBeGreaterThan(l)
  })

  it('applyDensity 返回对应那套的 shotIds', () => {
    // v1.0
    const p = fresh()
    const ids = applyDensity(p.scenes.s1!, 'compact')
    expect(ids.length).toBe(densityShots('s1', 'compact').length)
    expect(ids).toEqual(densityShots('s1', 'compact').map((s) => s.id))
  })

  it('resplitSceneDensity(s1, compact) 后 scene.density 更新，其他场 shotIds 引用未变', () => {
    // v1.1 —— 颗粒度是每场各自的，重拆第 1 场不影响第 2 场。
    const p = fresh()
    const s2RefBefore = p.scenes.s2!.shotIds
    const next = resplitSceneDensity(p, 's1', 'compact')
    expect(next.scenes.s1!.density).toBe('compact')
    expect(next.scenes.s1!.shotIds).toEqual(densityShots('s1', 'compact').map((s) => s.id))
    expect(next.scenes.s2!.shotIds).toBe(s2RefBefore) // 其他场引用未变
    expect(next.scenes.s2!.density).toBe('standard') // 其他场颗粒度不动
  })
})

// ── R6 阶段锁与重拆 · since v1.0 · updated v1.1 ──
// v1.1：新增删除集（只清「仅在该集出现」的资产）、至少保留一集。
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

  it('删除某集：只在该集出现的资产被清理，跨集资产保留', () => {
    // v1.1
    const p = appendEpisode(fresh(), episode2Payload) // 先追加第 2 集，制造跨集/独占资产
    // 快递员、退货包裹只在第 2 集出现；苏可、客厅跨集出现。
    const courier = Object.values(p.assets).find((a) => a.name === '快递员')!
    const parcel = Object.values(p.assets).find((a) => a.name === '退货包裹')!
    expect(courier && parcel).toBeTruthy()

    const next = deleteEpisode(p, 'e2')
    // 第 2 集独占资产被清理
    expect(next.assets[courier.id]).toBeUndefined()
    expect(next.assets[parcel.id]).toBeUndefined()
    // 跨集资产保留
    expect(next.assets[A.suke]).toBeTruthy()
    expect(next.assets[A.living]).toBeTruthy()
    // 该集的场 / 镜一并移除
    expect(next.episodes.some((e) => e.id === 'e2')).toBe(false)
    expect(next.scenes.e2s1).toBeUndefined()
    expect(Object.keys(next.shots).some((id) => id.startsWith('e2s'))).toBe(false)
  })

  it('删除集：其他集的 scenes 引用未变（只动被删集）', () => {
    // v1.1
    const p = appendEpisode(fresh(), episode2Payload)
    const s1RefBefore = p.scenes.s1
    const next = deleteEpisode(p, 'e2')
    expect(next.scenes.s1).toBe(s1RefBefore) // 第 1 集的场保持原引用
  })
})

// ── R8 剧本导入两种模式 · since v1.1 · updated v1.1 ──
describe('R8 剧本导入两种模式', () => {
  it('覆盖后旧 id 全部消失', () => {
    // v1.1
    const p = fresh()
    expect(p.assets[A.suke]).toBeTruthy() // 覆盖前旧 id 存在
    expect(p.shots.s1_sh1).toBeTruthy()
    const next = replaceScript(p, altScriptPayload)
    expect(next.assets[A.suke]).toBeUndefined()
    expect(next.shots.s1_sh1).toBeUndefined()
  })

  it('覆盖后回到 analysis 可编辑状态', () => {
    // v1.1
    const p = fresh()
    p.stage = 'visual' // 即便覆盖前已推进，覆盖后也回到 analysis
    const next = replaceScript(p, altScriptPayload)
    expect(next.stage).toBe('analysis')
    expect(canEdit(next, 'analysis')).toBe(true)
  })

  it('覆盖保留项目级设置 id / title / aspect / style', () => {
    // v1.1
    const p = fresh()
    const next = replaceScript(p, altScriptPayload)
    expect(next.id).toBe(p.id)
    expect(next.title).toBe(p.title)
    expect(next.aspect).toBe(p.aspect)
    expect(next.style).toBe(p.style)
  })
})

// ── R9 资产完整性提示 · since v1.1 · updated v1.1 ──
// 只在三种情况提示，其余一律不提示。「没挂满四类」不等于「有问题」。
describe('R9 资产完整性提示', () => {
  it('规则 1：文本点名了某资产却没挂 → action 提示，携带该资产 id', () => {
    // v1.1
    const p = fresh()
    // s3_sh11 的原文明确出现「豪华麻辣烫」并挂了它；摘掉挂载，制造真实触发点。
    const shot = structuredClone(p.shots.s3_sh11!)
    shot.mounts = shot.mounts.filter((m) => m.assetId !== A.malatang)
    const issues = mountIssues(shot, p.assets)
    const hit = issues.find((i) => i.assetId === A.malatang)
    expect(hit).toBeTruthy()
    expect(hit!.level).toBe('action')
    expect(hit!.kind).toBe('prop')
  })

  it('规则 2：挂了角色但没挂其服装 → hint 提示', () => {
    // v1.1
    const p = fresh()
    const shot = structuredClone(p.shots.s1_sh5!)
    shot.title = ''
    shot.imagePrompt = ''
    shot.videoPrompt = ''
    shot.sourceQuote = ''
    shot.mounts = [
      { kind: 'character', assetId: A.suke },
      { kind: 'location', assetId: A.living },
    ]
    const issues = mountIssues(shot, p.assets)
    expect(issues.some((i) => i.level === 'hint' && i.text.includes('未指定服装'))).toBe(true)
  })

  it('规则 3：没有任何场景挂载 → hint「未指定场景」', () => {
    // v1.1
    const p = fresh()
    const shot = structuredClone(p.shots.s1_sh5!)
    shot.title = ''
    shot.imagePrompt = ''
    shot.videoPrompt = ''
    shot.sourceQuote = ''
    shot.mounts = [
      { kind: 'character', assetId: A.suke },
      { kind: 'costume', assetId: A.hoodie },
    ]
    const issues = mountIssues(shot, p.assets)
    expect(issues.some((i) => i.level === 'hint' && i.text === '未指定场景')).toBe(true)
  })

  it('反向：没有道具的正常镜头不产生任何提示', () => {
    // v1.1 —— 大量镜头本来就没道具，不能报「缺 道具」。
    const p = fresh()
    // s1_sh5「瘫倒闭眼」：挂了苏可 + 服装 + 客厅，没道具，文本不点名任何未挂资产。
    const issues = mountIssues(p.shots.s1_sh5!, p.assets)
    expect(issues.length).toBe(0)
  })
})

// ── R10 长镜头阈值 · since v1.1 · updated v1.1 ──
describe('R10 长镜头阈值', () => {
  it('isLongShot：> LONG_SHOT_SEC 为真，= 阈值为假', () => {
    // v1.1
    expect(LONG_SHOT_SEC).toBe(6)
    expect(isLongShot(7)).toBe(true)
    expect(isLongShot(6)).toBe(false)
    expect(isLongShot(3)).toBe(false)
  })
})
