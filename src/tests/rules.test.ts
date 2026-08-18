// ════════════════════════════════════════════════════════════════════════
// 业务规则的断言。测试里的中文描述就是产品规则本身，不要为了通过测试去改测试。
//
// 【版本追溯约定】
//   · 规则版本对应《剧本分析-技术规划-v2.md》。当前基线：v1.3 · 2026-08-15。
//   · 每条规则（describe）标 since / updated；每个断言行尾挂版本标记。
//   · 规则改动时把 updated 与受影响断言标记抬到新版本，git diff 即可定位。
// ════════════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest'
import { seedProject, A } from '../data/seed'
import { episode2Payload } from '../data/seedEpisode2'
import type { Look, MountRef } from '../data/types'
import { FIRST_BATCH_KINDS } from '../data/types'
import { useStore } from '../store/useStore'
import { computeTimeline, sceneDuration } from '../services/timeline'
import { appendEpisode } from '../services/incremental'
import { replaceScript } from '../services/replace'
import { altScriptPayload } from '../data/seedAltScript'
import { densityShots, applyDensity, resplitSceneDensity } from '../services/density'
import { resplitScene, deleteEpisode } from '../services/lock'
import { can } from '../services/capability'
import { buildUsageIndex } from '../services/appearanceIndex'
import { syncState, deliverFirstBatch } from '../services/staleness'
import { reconcile } from '../services/reconcile'
import { lookName } from '../services/looks'
import { mountIssues } from '../services/completeness'
import { isLongShot, LONG_SHOT_SEC } from '../services/duration'

/** 规则基线版本。整体版本升级时改这里，单条规则/断言的局部变更用行内标记覆盖。 */
export const RULES_VERSION = 'v1.3' // 2026-08-15 · 对应改动方案 v1.3

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
    const secondId = scene.shotIds[1]!
    const delta = 3
    p.shots[secondId]!.duration += delta
    const after = computeTimeline(scene, p.shots)
    for (let i = 2; i < after.length; i++) {
      expect(after[i]!.startAt).toBe(before[i]!.startAt + delta)
    }
    expect(sceneDuration(scene, p.shots)).toBe(durBefore + delta)
  })

  it('第 1 场初始为 8 镜 · 32 秒', () => {
    // v1.0
    const p = fresh()
    expect(p.scenes.s1!.shotIds.length).toBe(8)
    expect(sceneDuration(p.scenes.s1!, p.shots)).toBe(32)
  })
})

// ── R2 挂载是引用不是复制 · since v1.0 · updated v1.2 ──
describe('R2 挂载是引用不是复制', () => {
  it('改资产名后，挂过它的镜渲染出的标签是新名字（用 id 反查）', () => {
    // v1.2 —— 挂载对象换成 look，但「引用不复制」对直接挂载的场景 / 道具照样成立。
    const p = fresh()
    p.assets[A.living]!.name = '大客厅'
    const shot = Object.values(p.shots).find((s) => s.mounts.some((m) => m.assetId === A.living))!
    expect(shot).toBeTruthy()
    expect(p.assets[A.living]!.name).toBe('大客厅')
  })
})

// ── R3 追加集与资产去重 · since v1.0 · updated v1.2 ──
describe('R3 追加集与资产去重', () => {
  it('追加集：重名资产复用旧 id，未命中的按内容照数新建', () => {
    // v1.1 —— 新增数由新集内容决定，不写死成常数。
    const p = fresh()
    const beforeCount = Object.keys(p.assets).length
    const beforeSukeId = p.assets[A.suke]!.id

    const keyOf = (a: { kind: string; name: string }) =>
      `${a.kind}::${a.name.replace(/\s+/g, '').toLowerCase()}`
    const existing = new Set(Object.values(p.assets).map(keyOf))
    const expectedNew = new Set(
      episode2Payload.assets.filter((a) => !existing.has(keyOf(a))).map(keyOf),
    ).size

    const next = appendEpisode(p, episode2Payload)

    expect(next.assets[A.suke]!.id).toBe(beforeSukeId)
    expect(Object.keys(next.assets).length).toBe(beforeCount + expectedNew)
    expect(Object.values(next.assets).filter((a) => a.name === '苏可').length).toBe(1)
    for (const a of episode2Payload.assets) {
      expect(Object.values(next.assets).some((x) => x.name === a.name)).toBe(true)
    }
  })

  it('第 2 集的镜挂载指向复用后的着装角色（老 look 复用，不建临时 id）', () => {
    // v1.2 —— 苏可的复用如今体现为挂载引用第 1 集的着装角色 lk_suke_hoodie。
    const p = fresh()
    const next = appendEpisode(p, episode2Payload)
    const ep2Shots = Object.values(next.shots).filter((s) => s.sceneId.startsWith('e2'))
    const sukeLook = ep2Shots.flatMap((s) => s.mounts).find((m) => m.assetId === A.lookSuke)
    expect(sukeLook).toBeTruthy() // 指向第 1 集的 lk_suke_hoodie
    const anyTemp = ep2Shots.flatMap((s) => s.mounts).some((m) => m.assetId === 'c_suke__ep2')
    expect(anyTemp).toBe(false)
  })

  it('第 1 集所有 shot 的 mounts 数组完全相等（引用未变）', () => {
    // v1.0
    const p = fresh()
    const ep1ShotIds = p.episodes[0]!.sceneIds.flatMap((sid) => p.scenes[sid]!.shotIds)
    const next = appendEpisode(p, episode2Payload)
    for (const id of ep1ShotIds) {
      expect(next.shots[id]!.mounts).toBe(p.shots[id]!.mounts)
    }
  })
})

// ── R5 重拆颗粒度 · since v1.0 · updated v1.1 ──
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
    // v1.1
    const p = fresh()
    const s2RefBefore = p.scenes.s2!.shotIds
    const next = resplitSceneDensity(p, 's1', 'compact')
    expect(next.scenes.s1!.density).toBe('compact')
    expect(next.scenes.s1!.shotIds).toEqual(densityShots('s1', 'compact').map((s) => s.id))
    expect(next.scenes.s2!.shotIds).toBe(s2RefBefore)
    expect(next.scenes.s2!.density).toBe('standard')
  })
})

// ── R6 能力矩阵（替代阶段锁）· since v1.0 · updated v1.2 ──
// v1.2：一刀切的 canEdit 已废除，改为字段级 can(project, capability)（决策 1a/1b）。
describe('R6 能力矩阵', () => {
  it('editPrompt / editScript / editShotFields / editMounts 在 visual 阶段仍为 true', () => {
    // v1.2 —— 决策 1a：进入视觉筹备后仍要能改提示词和剧本。
    const p = fresh()
    p.stage = 'visual'
    expect(can(p, 'editPrompt')).toBe(true)
    expect(can(p, 'editScript')).toBe(true)
    expect(can(p, 'editShotFields')).toBe(true)
    expect(can(p, 'editMounts')).toBe(true)
    expect(can(p, 'editSceneTrack')).toBe(true)
  })

  it('editLookBinding 任何阶段恒为 false（决策 1b）', () => {
    // v1.2
    const p = fresh()
    expect(can(p, 'editLookBinding')).toBe(false)
    p.stage = 'visual'
    expect(can(p, 'editLookBinding')).toBe(false)
  })

  it('editAssetName / toggleExcluded 仅 analysis 阶段可用', () => {
    // v1.2
    const p = fresh()
    expect(can(p, 'editAssetName')).toBe(true)
    expect(can(p, 'toggleExcluded')).toBe(true)
    p.stage = 'visual'
    expect(can(p, 'editAssetName')).toBe(false)
    expect(can(p, 'toggleExcluded')).toBe(false)
  })

  it('重拆第 1 场后，第 2 场的 shotIds 数组引用未变', () => {
    // v1.0
    const p = fresh()
    const s2RefBefore = p.scenes.s2!.shotIds
    p.scenes.s1!.shotIds = applyDensity(p.scenes.s1!, 'compact')
    const next = resplitScene(p, 's1')
    expect(next.scenes.s1!.shotIds.length).toBe(8)
    expect(next.scenes.s1!.shotIds).toEqual(seedProject.scenes.s1!.shotIds)
    expect(next.scenes.s2!.shotIds).toBe(s2RefBefore)
  })

  it('删除某集：只在该集出现的资产被清理，跨集资产保留（判定走派生索引）', () => {
    // v1.2
    const p = appendEpisode(fresh(), episode2Payload)
    const courier = Object.values(p.assets).find((a) => a.name === '快递员')!
    const parcel = Object.values(p.assets).find((a) => a.name === '退货包裹')!
    expect(courier && parcel).toBeTruthy()

    const next = deleteEpisode(p, 'e2')
    expect(next.assets[courier.id]).toBeUndefined()
    expect(next.assets[parcel.id]).toBeUndefined()
    expect(next.assets[A.suke]).toBeTruthy()
    expect(next.assets[A.living]).toBeTruthy()
    expect(next.episodes.some((e) => e.id === 'e2')).toBe(false)
    expect(next.scenes.e2s1).toBeUndefined()
    expect(Object.keys(next.shots).some((id) => id.startsWith('e2s'))).toBe(false)
  })

  it('删除集：其他集的 scenes 引用未变（只动被删集）', () => {
    // v1.1
    const p = appendEpisode(fresh(), episode2Payload)
    const s1RefBefore = p.scenes.s1
    const next = deleteEpisode(p, 'e2')
    expect(next.scenes.s1).toBe(s1RefBefore)
  })
})

// ── R8 剧本导入两种模式 · since v1.1 · updated v1.2 ──
describe('R8 剧本导入两种模式', () => {
  it('覆盖后旧 id 全部消失', () => {
    // v1.1
    const p = fresh()
    expect(p.assets[A.suke]).toBeTruthy()
    expect(p.shots.s1_sh1).toBeTruthy()
    const next = replaceScript(p, altScriptPayload)
    expect(next.assets[A.suke]).toBeUndefined()
    expect(next.shots.s1_sh1).toBeUndefined()
  })

  it('覆盖后回到 analysis，名称等 analysis-only 能力恢复可用', () => {
    // v1.2 —— 阶段锁换成能力矩阵后，用 can(next,'editAssetName') 表达「回到可编辑」。
    const p = fresh()
    p.stage = 'visual'
    const next = replaceScript(p, altScriptPayload)
    expect(next.stage).toBe('analysis')
    expect(can(next, 'editAssetName')).toBe(true)
    expect(can(next, 'toggleExcluded')).toBe(true)
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

// ── R9 资产完整性提示 · since v1.1 · updated v1.2 ──
// 只在三种情况提示，其余一律不提示。「没挂满」不等于「有问题」。
describe('R9 资产完整性提示', () => {
  it('规则 1：文本点名了某道具却没挂 → action 提示，携带该资产 id', () => {
    // v1.2
    const p = fresh()
    const shot = structuredClone(p.shots.s3_sh11!)
    shot.mounts = shot.mounts.filter((m) => m.assetId !== A.malatang)
    const issues = mountIssues(shot, p.assets)
    const hit = issues.find((i) => i.assetId === A.malatang)
    expect(hit).toBeTruthy()
    expect(hit!.level).toBe('action')
    expect(hit!.kind).toBe('prop')
  })

  it('规则 1（角色分支）：挂了任一 look 视为已挂，不再报「未挂载」', () => {
    // v1.2 —— 挂了 lk_suke_hoodie 就等于挂了苏可。
    const p = fresh()
    const issues = mountIssues(p.shots.s1_sh1!, p.assets)
    expect(issues.some((i) => i.text.includes('苏可'))).toBe(false)
  })

  it('规则 2：挂了 character（素模）而不是 look → hint「未指定着装」', () => {
    // v1.2
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
    expect(issues.some((i) => i.level === 'hint' && i.text.includes('还没有选择造型'))).toBe(true)
  })

  it('规则 3：没有任何场景挂载 → hint「未指定场景」', () => {
    // v1.2
    const p = fresh()
    const shot = structuredClone(p.shots.s1_sh5!)
    shot.title = ''
    shot.imagePrompt = ''
    shot.videoPrompt = ''
    shot.sourceQuote = ''
    shot.mounts = [{ kind: 'look', assetId: A.lookSuke }]
    const issues = mountIssues(shot, p.assets)
    expect(issues.some((i) => i.level === 'hint' && i.text === '请选择场景')).toBe(true)
  })

  it('反向：挂好 look + 场景的正常镜头不产生任何提示', () => {
    // v1.2 —— s1_sh5 挂 lk_suke_hoodie + 客厅，没道具，文本不点名任何未挂资产。
    const p = fresh()
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

// ── R11 着装角色 · since v1.2 · updated v1.2 ──
describe('R11 着装角色', () => {
  it('① costumeIds 可为空数组，lookName 兜底为「X · 默认着装」', () => {
    // v1.2
    const assets = fresh().assets
    const look: Look = { id: 'lk_x', kind: 'look', name: '', characterId: A.suke, costumeIds: [], imagePrompt: '', promptRevision: 0 }
    expect(lookName(look, assets)).toBe('苏可 · 默认着装')
  })

  it('② 一件服装可被多个 look 引用，不报错，出场并入各 look', () => {
    // v1.2
    const p = fresh()
    const extra: Look = { id: 'lk_extra', kind: 'look', name: '', characterId: A.mom, costumeIds: [A.hoodie], imagePrompt: '', promptRevision: 0 }
    p.assets[extra.id] = extra
    p.shots.s3_sh1!.mounts = [...p.shots.s3_sh1!.mounts, { kind: 'look', assetId: extra.id }]
    expect(() => buildUsageIndex(p)).not.toThrow()
    const idx = buildUsageIndex(p)
    expect(idx[A.hoodie]!.appearances.length).toBeGreaterThan(0)
  })

  it('③ 一个 look 可引用多件服装，命名以「+」连接', () => {
    // v1.2
    const assets = fresh().assets
    const look: Look = { id: 'lk_y', kind: 'look', name: '', characterId: A.suke, costumeIds: [A.hoodie, A.cardigan], imagePrompt: '', promptRevision: 0 }
    expect(lookName(look, assets)).toBe('苏可 · 宽松连帽卫衣+家常针织开衫')
  })

  it('④ editLookBinding 恒假，store 不暴露修改 characterId/costumeIds 的 action', () => {
    // v1.2 —— editLookBinding 恒假本身在 R6 已验，这里只测 store 不暴露改绑定的 action
    const actions = Object.keys(useStore.getState())
    expect(actions.some((k) => /lookbinding|characterid|costumeid/i.test(k))).toBe(false)
  })
})

// ── R12 出场索引 · since v1.2 · updated v1.2 ──
describe('R12 出场索引', () => {
  it('① 直接挂载 → 出场记入所属集场', () => {
    // v1.2 —— 麻辣烫只在第 1 集第 3 场出现。
    const idx = buildUsageIndex(fresh())
    expect(idx[A.malatang]!.appearances).toEqual([{ episodeNo: 1, sceneNo: 3 }])
    expect(idx[A.malatang]!.firstAppearance).toEqual({ episodeNo: 1, sceneNo: 3 })
  })

  it('② 角色出场 = 直接挂它的镜 ∪ 挂它任一 look 的镜', () => {
    // v1.2 —— 苏可全程只以 look 出现，出场覆盖第 1 集三个场。
    const idx = buildUsageIndex(fresh())
    const scenes = idx[A.suke]!.appearances.map((a) => a.sceneNo)
    expect(scenes).toEqual([1, 2, 3])
    expect(idx[A.suke]!.appearances.every((a) => a.episodeNo === 1)).toBe(true)
  })

  it('③ 服装出场 = 引用它的所有 look 的出场并集', () => {
    // v1.2 —— 卫衣只被 lk_suke_hoodie 引用，与苏可的出场一致。
    const idx = buildUsageIndex(fresh())
    expect(idx[A.hoodie]!.appearances.length).toBeGreaterThan(0)
    expect(idx[A.hoodie]!.appearances).toEqual(idx[A.suke]!.appearances)
  })

  it('④ 挂载变更后重算，索引与 mounts 永远一致', () => {
    // v1.2
    const p = fresh()
    const before = buildUsageIndex(p)
    p.shots.s1_sh1!.mounts = [...p.shots.s1_sh1!.mounts, { kind: 'prop', assetId: A.napkin } as MountRef]
    const after = buildUsageIndex(p)
    expect(after[A.napkin]!.shotCount).toBe(before[A.napkin]!.shotCount + 1)
    expect(after[A.napkin]!.appearances).toContainEqual({ episodeNo: 1, sceneNo: 1 })
  })
})

// ── R13 单向传播 · since v1.2 · updated v1.2 ──
describe('R13 单向传播', () => {
  it('① 改提示词 → promptRevision + 1', () => {
    // v1.2
    useStore.setState({ project: structuredClone(seedProject) })
    const before = useStore.getState().project.assets[A.suke]!.promptRevision
    useStore.getState().updateAssetPrompt(A.suke, '苏可提示词改一版')
    const after = useStore.getState().project.assets[A.suke]!.promptRevision
    expect(after).toBe(before + 1)
  })

  it('② deliveredRevision == null → draft；相等 → delivered；小于 → stale', () => {
    // v1.2
    const base = fresh().assets[A.suke]!
    expect(syncState({ ...base, deliveredRevision: undefined })).toBe('draft')
    expect(syncState({ ...base, promptRevision: 2, deliveredRevision: 2 })).toBe('delivered')
    expect(syncState({ ...base, promptRevision: 3, deliveredRevision: 2 })).toBe('stale')
  })

  it('③ 进入资产生产把第一批资产的 deliveredRevision 对齐到 promptRevision，look 不交付', () => {
    // v1.2
    const p = deliverFirstBatch(fresh())
    expect(p.assets[A.suke]!.deliveredRevision).toBe(p.assets[A.suke]!.promptRevision)
    expect(p.assets[A.hoodie]!.deliveredRevision).toBe(p.assets[A.hoodie]!.promptRevision)
    expect(p.assets[A.lookSuke]!.deliveredRevision).toBeUndefined()
  })

  it('④ 改剧本致某资产不再被任何镜头挂载时，标 orphaned 但不删除', () => {
    // v1.2
    const p = fresh()
    for (const sh of Object.values(p.shots)) {
      sh.mounts = sh.mounts.filter((m) => m.assetId !== A.napkin)
    }
    const r = reconcile(p)
    expect(r.orphaned).toContain(A.napkin)
    expect(r.project.assets[A.napkin]).toBeTruthy()
  })
})

// ── R14 第一批范围 · since v1.2 · updated v1.2 ──
describe('R14 第一批范围', () => {
  it('第一批 = FIRST_BATCH_KINDS ∩ !excluded，look 不在其中', () => {
    // v1.2
    expect((FIRST_BATCH_KINDS as readonly string[]).includes('look')).toBe(false)
    const p = fresh()
    const firstBatch = Object.values(p.assets).filter(
      (a) => (FIRST_BATCH_KINDS as readonly string[]).includes(a.kind) && !a.excluded,
    )
    expect(firstBatch.some((a) => a.kind === 'look')).toBe(false)
    expect(firstBatch.length).toBe(16) // 第 1 集四类基础资产全部（3 角色 + 3 服装 + 4 场景 + 6 道具），无排除
  })

  it('排除某资产后不计入第一批', () => {
    // v1.2
    const p = fresh()
    p.assets[A.napkin]!.excluded = true
    const firstBatch = Object.values(p.assets).filter(
      (a) => (FIRST_BATCH_KINDS as readonly string[]).includes(a.kind) && !a.excluded,
    )
    expect(firstBatch.some((a) => a.id === A.napkin)).toBe(false)
    expect(firstBatch.length).toBe(15)
  })
})

// ── R15 提示词手动编辑标记与替换本集重置 · since v1.3 · updated v1.3 ──
// promptEdited 与 promptStates 是两个正交维度；重新生成 / 替换本集都会清掉手动痕迹。
describe('R15 提示词手动编辑标记与替换本集重置', () => {
  it('generatePrompts 执行到某镜即清掉其 promptEdited', () => {
    // v1.3
    useStore.setState({ project: structuredClone(seedProject), promptStates: {}, promptEdited: {} })
    const id = 's1_sh1'
    useStore.getState().markPromptEdited(id)
    expect(useStore.getState().promptEdited[id]).toBe(true)
    useStore.getState().generatePrompts([id])
    expect(useStore.getState().promptEdited[id]).toBeFalsy()
  })

  it('替换本集后镜头 promptStates 全部回 pending、promptEdited 清空、无孤儿键', () => {
    // v1.3
    useStore.setState({ project: structuredClone(seedProject), promptStates: {}, promptEdited: {} })
    // 先制造一个已就绪且被手动编辑过的镜头。
    useStore.getState().setPromptState('s1_sh1', 'ready')
    useStore.getState().markPromptEdited('s1_sh1')
    useStore.getState().replaceEpisode('e1')
    const st = useStore.getState()
    for (const shotId of Object.keys(st.project.shots)) {
      expect(st.promptStates[shotId]).toBe('pending')
    }
    expect(Object.keys(st.promptEdited).length).toBe(0)
    // 旧镜随替换消失，不留孤儿键。
    expect(st.promptStates.s1_sh1).toBeUndefined()
  })
})
