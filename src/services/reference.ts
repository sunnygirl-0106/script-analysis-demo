// 参考图清单（喂给生图模型的契约，区别于用户看的「生产挂载」）。纯函数。
//
// 交接文档 10.2 第三条「一个镜其实有两套资产列表」的正面回答：
//   · 生产挂载 = 四类全列（用户在分镜表看到、可增删）
//   · 参考图清单 = 每个已挂角色恰好一张定妆图（角色素模 + 其服装融合）+ 场景与道具本身
// 两者由同一份 mounts 派生，不给用户第二套勾选界面。
import type { Asset, MountRef, Shot } from '../data/types'

export interface RefImage {
  kind: MountRef['kind']
  assetId: string
  /** kind === 'character' 时携带：这张定妆图融合进来的服装 id（可能缺，表示暂无服装）。 */
  costumeId?: string
}

/**
 * 一个镜要喂给生图模型的参考图清单：
 * 每个已挂角色恰好 1 张定妆图（角色 + 其服装），加上场景与道具本身。
 * 服装不单独成条 —— 它已融进对应角色的定妆图。
 */
export function referenceImages(shot: Shot, assets: Record<string, Asset>): RefImage[] {
  const out: RefImage[] = []
  const mountedIds = new Set(shot.mounts.map((m) => m.assetId))

  for (const mref of shot.mounts) {
    const asset = assets[mref.assetId]
    if (!asset) continue
    if (asset.kind === 'costume') continue // 服装并入角色定妆图，不单列
    if (asset.kind === 'character') {
      // 找出这个镜里挂着的、属于该角色的服装，融进定妆图。
      const costume = Object.values(assets).find(
        (a) => a.kind === 'costume' && a.characterId === asset.id && mountedIds.has(a.id),
      )
      out.push({ kind: 'character', assetId: asset.id, costumeId: costume?.id })
    } else {
      out.push({ kind: asset.kind, assetId: asset.id })
    }
  }
  return out
}
