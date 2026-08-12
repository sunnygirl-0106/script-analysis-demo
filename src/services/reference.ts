// 参考图清单（喂给生图模型的契约）。纯函数。
//
// 新口径：每个镜直接引用已确定的着装角色、场景与道具。
//   · 着装角色（look）本身就是「角色 + 服装」融合后的定妆图，不再在镜头里临时拼装。
//   · 独立服装（costume）是第一批基础资产，不进参考图清单、也不自动挂载。
import type { Asset, MountRef, Shot } from '../data/types'

export interface RefImage {
  kind: MountRef['kind'] // 'look' | 'location' | 'prop'
  assetId: string
}

/**
 * 一个镜要喂给生图模型的参考图清单：直接取 mounts 里的 look / location / prop。
 * 挂载已经只允许这三类，这里再过滤一次并剔除已删除的资产。
 */
export function referenceImages(shot: Shot, assets: Record<string, Asset>): RefImage[] {
  const out: RefImage[] = []
  for (const mref of shot.mounts) {
    if (mref.kind !== 'look' && mref.kind !== 'location' && mref.kind !== 'prop') continue
    if (!assets[mref.assetId]) continue
    out.push({ kind: mref.kind, assetId: mref.assetId })
  }
  return out
}
