// 星钻计价。纯函数，不碰 UI。演示口径——真实单价等陈硕确认，改 RATE 一处即可。
// 术语统一：全仓库「算力 / ⚡」一律读作「星钻 / ✦」。
import type { ShotDensity } from '../data/types'
import { densityShots } from './density'
import { seedProject } from '../data/seed'

export const RATE = {
  extractPerKChar: 8, // 提取资产：每千字 ✦8
  splitPerKChar: 6, // 拆分场 / 镜：每千字 ✦6
  shot: 1, // 按镜估价，保留给两个重拆弹窗（它们仍按镜数报价）
  assetPrompt: 1, // 单条资产提示词补全：✦1
  shotPrompt: 6, // 单镜画面/视频提示词：✦6
} as const

/** 节奏档位对拆分单价的系数（v2.4 §8）。镜头越密，拆分的活越多。 */
export const DENSITY_COEF: Record<ShotDensity, number> = { compact: 1.25, standard: 1, loose: 0.8 }

/**
 * 预计某场在某颗粒度下会拆出多少镜。
 * 单一真相源顺序：① 有密度预设的场取预设镜数；② 否则取 seedProject 里该场的标准镜数
 * （seedProject 就是「拆完」的参照）；③ 再兜底一个按密度的经验值。
 */
export function estimateShots(sceneIds: string[], density: ShotDensity = 'standard'): number {
  const fallback: Record<ShotDensity, number> = { compact: 6, standard: 8, loose: 5 }
  return sceneIds.reduce((sum, id) => {
    const preset = densityShots(id, density).length
    if (preset > 0) return sum + preset
    const seeded = seedProject.scenes[id]?.shotIds.length ?? 0
    return sum + (seeded || fallback[density])
  }, 0)
}

/** 提取资产 = 字数 × ✦8/千字。字数已知 ⇒ 这是确定值，不给区间（v2.4 §8）。 */
export function costExtract(words: number): number {
  return Math.max(1, Math.ceil(words / 1000) * RATE.extractPerKChar)
}

/** 拆分 = 字数 × ✦6/千字 × 档位系数。同样是确定值。 */
export function costSplitByWords(words: number, density: ShotDensity): number {
  return Math.max(1, Math.round(Math.ceil(words / 1000) * RATE.splitPerKChar * DENSITY_COEF[density]))
}

/** 按预计镜数估拆分消耗：每镜 ✦1。 */
export function costSplit(sceneIds: string[], density: ShotDensity = 'standard'): number {
  return estimateShots(sceneIds, density) * RATE.shot
}

/** 批量镜头提示词：每镜 ✦6。 */
export function costShotPrompts(shotIds: string[]): number {
  return shotIds.length * RATE.shotPrompt
}

/** 单条资产提示词补全：✦1。 */
export function costAssetPrompt(): number {
  return RATE.assetPrompt
}

/** 统一渲染成 `✦25`。 */
export function fmtCost(n: number): string {
  return `✦${n}`
}

// ── 生成前估算（v2.5 §6.3）──
// 口径全部从**字数**推：seed 只有 3 场 25 镜，拿它当参照会算出「25 镜」这种明显偏小的数，
// 而用户手上是 4,800 字的一集。字数是上传那一刻就确定的量，用它推场 / 镜才有说服力。
// 镜数是生成前的估算 ⇒ 一律给区间；价格按字数 × 档位系数 ⇒ 是确定值，不给区间。
export const EST = {
  /** 每 400 字约 1 场。 */
  charsPerScene: 400,
  /** 每镜承载的字数：镜头越密，一个镜吃的字越少。 */
  charsPerShot: { compact: 24, standard: 30, loose: 40 } as Record<ShotDensity, number>,
  /** 每镜时长，只作展示。 */
  secPerShot: { compact: '3–5', standard: '5–8', loose: '8–12' } as Record<ShotDensity, string>,
  /** 区间上限 = 下限 × 1.08。 */
  rangeSpread: 0.08,
} as const

/** 预计场数：字数 / 400，至少 1 场。 */
export function estimateScenes(words: number): number {
  return Math.max(1, Math.round(words / EST.charsPerScene))
}

/** 预计镜数区间（取整到 5）：4,800 字标准档 → [160, 175]。 */
export function estimateShotRange(words: number, dn: ShotDensity): [number, number] {
  const base = words / EST.charsPerShot[dn]
  const lo = Math.max(5, Math.round(base / 5) * 5)
  const hi = Math.max(lo + 5, Math.ceil((lo * (1 + EST.rangeSpread)) / 5) * 5)
  return [lo, hi]
}
