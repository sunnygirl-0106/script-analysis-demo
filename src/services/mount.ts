// R4 挂载默认值，不是禁令。纯函数。
// 规则版本：v1.0（2026-08-10）。断言见 tests/rules.test.ts 的 R4。
import type { Asset, Costume, MountRef, Shot } from '../data/types'

export interface MountHint {
  level: 'info'
  text: string
}

function costumesOf(characterId: string, assets: Record<string, Asset>): Costume[] {
  return Object.values(assets).filter(
    (a): a is Costume => a.kind === 'costume' && a.characterId === characterId,
  )
}

/**
 * 默认：挂了某个角色，连同他在这场穿的服装一起挂上（这就是定妆图）。
 * 在原有挂载基础上补齐每个已挂角色的服装，去重。
 */
export function defaultMounts(shot: Shot, assets: Record<string, Asset>): MountRef[] {
  const result: MountRef[] = [...shot.mounts]
  const has = (id: string) => result.some((m) => m.assetId === id)

  for (const mref of shot.mounts) {
    const asset = assets[mref.assetId]
    if (asset?.kind !== 'character') continue
    for (const costume of costumesOf(asset.id, assets)) {
      if (!has(costume.id)) result.push({ kind: 'costume', assetId: costume.id })
    }
  }
  return result
}

/**
 * 不禁止任何组合。只在「同时挂了角色素模 + 该角色的服装」时返回一条 info 级提示。
 * 提示不阻断。
 */
export function checkMounts(mounts: MountRef[], assets: Record<string, Asset>): MountHint[] {
  const hints: MountHint[] = []
  const mountedIds = new Set(mounts.map((m) => m.assetId))

  for (const mref of mounts) {
    const asset = assets[mref.assetId]
    if (asset?.kind !== 'character') continue
    const hasCostume = costumesOf(asset.id, assets).some((c) => mountedIds.has(c.id))
    if (hasCostume) {
      hints.push({
        level: 'info',
        text: `「${asset.name}」的角色素模与定妆图同时挂载，两张参考图可能互相干扰，建议只留定妆图。`,
      })
    }
  }
  return hints
}
