// R5 镜头密度。纯函数。
// 规则版本：v1.0（2026-08-10）。断言见 tests/rules.test.ts 的 R5。
import type { Scene, Shot, ShotDensity } from '../data/types'
import { shotPresets } from '../data/shotPresets'

/**
 * 取某场某密度对应的整套镜（完整 Shot 对象）。
 * 没有该场的预设，或没有该密度的预设时，回退到「标准」/ 空。
 */
export function densityShots(sceneId: string, density: ShotDensity): Shot[] {
  const scenePresets = shotPresets[sceneId]
  if (!scenePresets) return []
  return scenePresets[density] ?? scenePresets.standard ?? []
}

/** 是否为该场准备了密度预设。没有则切换密度时保持原样。 */
export function hasDensityPresets(sceneId: string): boolean {
  return Boolean(shotPresets[sceneId])
}

/**
 * 从 shotPresets 里取对应那套预设替换本场的镜，返回新的 shotIds。
 * 切换后时间轴由 computeTimeline 重算。
 */
export function applyDensity(scene: Scene, density: ShotDensity): string[] {
  const preset = densityShots(scene.id, density)
  if (preset.length === 0) return scene.shotIds // 无预设，保持原样
  return preset.map((s) => s.id)
}
