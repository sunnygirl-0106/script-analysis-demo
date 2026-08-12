// 自动挂载：只过滤 / 补齐着装角色、场景、道具。纯函数。
//
// 旧逻辑「挂角色自动带出该角色所有服装」已删除：
//   · 服装不再自动挂载（它是第一批独立生产的基础资产，不作为分镜参考）。
//   · 人物参考一律走着装角色（look）。
//   · 不根据名称或归属关系自动猜着装角色 —— Look 关系由 AI 给定。
import type { AssetKind, MountRef, Shot } from '../data/types'

/** 允许自动挂载的三类。 */
function isMountable(kind: AssetKind): kind is MountRef['kind'] {
  return kind === 'look' || kind === 'location' || kind === 'prop'
}

/**
 * 在本镜已有挂载的基础上，并入 AI 检测到的挂载：
 *   · 只接收 look / location / prop，costume / character 一律忽略。
 *   · 按 assetId 去重（先到先得，保持顺序）。
 * detected 用较宽的类型，以便调用方（或测试）传入被忽略的 costume 也能被安全过滤掉。
 */
export function automaticMounts(
  shot: Shot,
  detected: ReadonlyArray<{ kind: AssetKind; assetId: string }>,
): MountRef[] {
  const out: MountRef[] = []
  const seen = new Set<string>()
  for (const ref of [...shot.mounts, ...detected]) {
    if (!isMountable(ref.kind)) continue
    if (seen.has(ref.assetId)) continue
    seen.add(ref.assetId)
    out.push({ kind: ref.kind, assetId: ref.assetId })
  }
  return out
}
