// R4 挂载默认值，不是禁令。纯函数。
// 规则版本：v1.1（2026-08-11）。断言见 tests/rules.test.ts 的 R4。
// v1.1 变更：素模不是可挂载对象，挂角色恒定带出一张定妆图，互斥提示删除。
import type { Asset, Costume, MountRef, Shot } from '../data/types'

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
