// 出场记录改为派生（重要）。纯函数。
//
// 为什么必须改：挂载对象从「角色 + 服装两条」变成「着装角色一条」后，
// seed 里手写的 appearances 与实际 mounts 必然对不上；而且服装本身不再挂镜，
// 它的出场只能从 look 反推。继续手写会持续腐烂 —— 索引从 mounts 一次遍历建出。
//
// 传播规则（三条，与 R12 断言一一对应）：
//   1. 直接挂载：look / location / prop / character 的出场 = 挂了它的镜所属的 (集号, 场号)
//   2. 角色向上聚合：character 的出场 = 直接挂它的镜 ∪ 挂了它任一 look 的镜
//   3. 服装向上聚合：costume 的出场 = 引用它的所有 look 的出场并集
import type { Appearance, Look, Project } from '../data/types'

export interface AssetUsage {
  appearances: Appearance[]     // 去重、按集场升序
  shotCount: number
  firstAppearance?: Appearance  // 排产依据
}

/** 一次遍历建全表索引。O(镜数 × 每镜挂载数)，25 镜的 demo 可以每次重算；
 *  真实 60 集数据在 store 里用 useMemo 缓存，project 变更时重算。 */
export function buildUsageIndex(project: Project): Record<string, AssetUsage> {
  const epNoById = new Map<string, number>()
  for (const ep of project.episodes) {
    for (const sid of ep.sceneIds) epNoById.set(sid, ep.no)
  }

  // assetId → 去重后的镜集合（算 shotCount）、去重后的出场集合。
  const shotsByAsset = new Map<string, Set<string>>()
  const appsByAsset = new Map<string, Map<string, Appearance>>()

  const touch = (assetId: string, shotId: string, ap: Appearance) => {
    let shots = shotsByAsset.get(assetId)
    if (!shots) shotsByAsset.set(assetId, (shots = new Set()))
    shots.add(shotId)
    let apps = appsByAsset.get(assetId)
    if (!apps) appsByAsset.set(assetId, (apps = new Map()))
    const key = `${ap.episodeNo}:${ap.sceneNo}`
    if (!apps.has(key)) apps.set(key, ap)
  }

  for (const shot of Object.values(project.shots)) {
    const scene = project.scenes[shot.sceneId]
    if (!scene) continue
    const episodeNo = epNoById.get(scene.id) ?? 0
    const ap: Appearance = { episodeNo, sceneNo: scene.no }

    for (const mref of shot.mounts) {
      const asset = project.assets[mref.assetId]
      if (!asset) continue
      // 规则 1：直接挂载记本资产。
      touch(asset.id, shot.id, ap)
      // 规则 2 / 3：look 向上聚合到它的角色与服装。
      if (asset.kind === 'look') {
        const look = asset as Look
        touch(look.characterId, shot.id, ap)
        for (const cid of look.costumeIds) touch(cid, shot.id, ap)
      }
    }
  }

  const index: Record<string, AssetUsage> = {}
  for (const id of Object.keys(project.assets)) {
    const appMap = appsByAsset.get(id)
    const appearances = appMap
      ? [...appMap.values()].sort((a, b) => a.episodeNo - b.episodeNo || a.sceneNo - b.sceneNo)
      : []
    index[id] = {
      appearances,
      shotCount: shotsByAsset.get(id)?.size ?? 0,
      firstAppearance: appearances[0],
    }
  }
  return index
}
