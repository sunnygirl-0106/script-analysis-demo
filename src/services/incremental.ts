// 追加集与资产去重。纯函数。追加集的资产新增数由新集内容决定。
// v2.0：新增着装角色的 characterId/costumeIds 也随去重重指（候选闸先入库角色后不悬空）。
import type { Asset, EpisodePayload, MountRef, Project, Shot } from '../data/types'

/** 归一化名称：去空格、统一小写，用于比对是否为同一资产。 */
function normalize(name: string): string {
  return name.replace(/\s+/g, '').toLowerCase()
}

/** 资产归一化 key：kind + 归一化名称。跨模块复用（替换 diff 也走这套匹配）。 */
export const assetKey = (a: Pick<Asset, 'kind' | 'name'>) => `${a.kind}::${normalize(a.name)}`

/**
 * 一集内容并进项目前的两件事：资产按归一化名称去重、镜头挂载重指到复用后的 id。
 * appendEpisode（集也是新的）与 fillEpisode（集已存在，只补场镜）共用这一段。
 */
function mergePayload(project: Project, payload: EpisodePayload) {
  // 1. 建立既有资产的「名称 → id」索引。
  const byKey = new Map<string, string>()
  for (const asset of Object.values(project.assets)) {
    byKey.set(assetKey(asset), asset.id)
  }

  // 2. 逐个处理新资产：命中则记重定向，未命中则新建。
  const remap = new Map<string, string>() // 新集内临时 id → 最终 id
  const addedAssets: Record<string, Asset> = {}
  for (const asset of payload.assets) {
    const key = assetKey(asset)
    const existingId = byKey.get(key)
    if (existingId) {
      remap.set(asset.id, existingId) // 复用旧 id，不新建
    } else {
      remap.set(asset.id, asset.id) // 保留自身 id
      addedAssets[asset.id] = asset
      byKey.set(key, asset.id)
    }
  }

  const resolve = (id: string): string => remap.get(id) ?? id

  // 新增的着装角色(look)：把它引用的角色 / 服装 id 也重指向到复用后的最终 id。
  // 关键在「候选闸先入库了角色，再走 appendEpisode」的场景：角色被去重到 committed id，
  // 若不一并重指，新 look 的 characterId 会悬空。自建集（角色也是新增）时 resolve 为自映射，无影响。
  for (const id of Object.keys(addedAssets)) {
    const a = addedAssets[id]!
    if (a.kind !== 'look') continue
    addedAssets[id] = {
      ...a,
      characterId: resolve(a.characterId),
      costumeIds: a.costumeIds.map(resolve),
    }
  }

  // 3. 新集的镜：挂载重指向到复用后的 id（其余既有资产 id 原样保留）。
  const remappedShots: Record<string, Shot> = {}
  for (const shot of Object.values(payload.shots)) {
    const mounts: MountRef[] = shot.mounts.map((m) => ({ kind: m.kind, assetId: resolve(m.assetId) }))
    remappedShots[shot.id] = { ...shot, mounts }
  }

  return { addedAssets, remappedShots }
}

/**
 * 追加一集：
 * - 已有的集 / 场 / 镜 / 资产一个字节都不动（保持引用相等）。
 * - 新集资产按归一化名称比对，命中已有则复用旧 id，不新建。
 * - 新集的镜挂载指向复用后的 id。
 */
export function appendEpisode(project: Project, payload: EpisodePayload): Project {
  const { addedAssets, remappedShots } = mergePayload(project, payload)
  // 既有 episodes / scenes / shots / assets 全部保持原引用。
  return {
    ...project,
    episodes: [...project.episodes, payload.episode],
    scenes: { ...project.scenes, ...payload.scenes },
    shots: { ...project.shots, ...remappedShots },
    assets: { ...project.assets, ...addedAssets },
  }
}

/**
 * 集已经在项目里（v2.4：「补充剧本」先落一个只有原文、没有场镜的草稿集），
 * 这一步只补它的场与镜：回填 sceneIds，集自己的 title / rawText / wordCount / extractedAt 原样保留。
 * 资产去重与挂载重指与 appendEpisode 完全一致。
 */
export function fillEpisode(project: Project, payload: EpisodePayload): Project {
  const { addedAssets, remappedShots } = mergePayload(project, payload)
  return {
    ...project,
    episodes: project.episodes.map((e) =>
      e.id === payload.episode.id ? { ...e, sceneIds: [...payload.episode.sceneIds] } : e,
    ),
    scenes: { ...project.scenes, ...payload.scenes },
    shots: { ...project.shots, ...remappedShots },
    assets: { ...project.assets, ...addedAssets },
  }
}
