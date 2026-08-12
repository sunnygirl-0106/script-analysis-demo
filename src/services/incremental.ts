// 追加集与资产去重。纯函数。追加集的资产新增数由新集内容决定。
import type { Asset, MountRef, Project, Shot } from '../data/types'
import type { EpisodePayload } from '../data/seedEpisode2'

/** 归一化名称：去空格、统一小写，用于比对是否为同一资产。 */
function normalize(name: string): string {
  return name.replace(/\s+/g, '').toLowerCase()
}

const assetKey = (a: Pick<Asset, 'kind' | 'name'>) => `${a.kind}::${normalize(a.name)}`

/**
 * 追加一集：
 * - 已有的集 / 场 / 镜 / 资产一个字节都不动（保持引用相等）。
 * - 新集资产按归一化名称比对，命中已有则复用旧 id，不新建。
 * - 新集的镜挂载指向复用后的 id。
 */
export function appendEpisode(project: Project, payload: EpisodePayload): Project {
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

  // 3. 新集的镜：挂载重指向到复用后的 id（其余既有资产 id 原样保留）。
  const remappedShots: Record<string, Shot> = {}
  for (const shot of Object.values(payload.shots)) {
    const mounts: MountRef[] = shot.mounts.map((m) => ({ kind: m.kind, assetId: resolve(m.assetId) }))
    remappedShots[shot.id] = { ...shot, mounts }
  }

  // 4. 合并。既有 episodes / scenes / shots / assets 全部保持原引用。
  return {
    ...project,
    episodes: [...project.episodes, payload.episode],
    scenes: { ...project.scenes, ...payload.scenes },
    shots: { ...project.shots, ...remappedShots },
    assets: { ...project.assets, ...addedAssets },
  }
}
