// 出场位置的展示工具函数（不是业务规则，独立成文件）。
// 60 集短剧的主角会出现在几百个场里，出场信息默认只给数字摘要，明细按需展开。
import type { Appearance } from '../data/types'

export interface AppearanceGroup {
  episodeNo: number
  label: string
}

export interface AppearanceSummary {
  episodeCount: number
  sceneCount: number
  groups: AppearanceGroup[]
}

// 单集场号超过这个数，尾部收成「+n」，整行不换行。
const MAX_SCENE_TOKENS = 12

/**
 * 把一集里的场号压缩成展示串：
 *   · 升序去重
 *   · 连续 ≥4 个压缩成「起–止」（run 长度 ≤3 保持逐个列出，与 appearance.test.ts 对齐）
 *   · 场号 token 数超过 12 时，尾部收成「+n」
 */
function compressScenes(sceneNos: number[]): string {
  const sorted = [...new Set(sceneNos)].sort((a, b) => a - b)
  const tokens: string[] = []
  let i = 0
  while (i < sorted.length) {
    let j = i
    while (j + 1 < sorted.length && sorted[j + 1]! === sorted[j]! + 1) j++
    const runLen = j - i + 1
    if (runLen >= 4) {
      tokens.push(`${sorted[i]}–${sorted[j]}`) // 连字符用 en dash
    } else {
      for (let k = i; k <= j; k++) tokens.push(String(sorted[k]))
    }
    i = j + 1
  }
  if (tokens.length > MAX_SCENE_TOKENS) {
    const head = tokens.slice(0, MAX_SCENE_TOKENS)
    return `${head.join('·')}+${tokens.length - MAX_SCENE_TOKENS}`
  }
  return tokens.join('·')
}

/**
 * 汇总出场记录：集数、总场数，以及按集分组（升序）的场号串。
 * 镜数不在这里算 —— 挂载会变，塞进 Appearance 就会不同步，由 store 的 countShotsOf 反查。
 */
export function summarizeAppearances(list: Appearance[]): AppearanceSummary {
  const byEpisode = new Map<number, number[]>()
  for (const ap of list) {
    const arr = byEpisode.get(ap.episodeNo) ?? []
    arr.push(ap.sceneNo)
    byEpisode.set(ap.episodeNo, arr)
  }

  const groups: AppearanceGroup[] = [...byEpisode.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([episodeNo, scenes]) => ({ episodeNo, label: compressScenes(scenes) }))

  const sceneCount = [...byEpisode.values()].reduce((n, scenes) => n + new Set(scenes).size, 0)

  return { episodeCount: byEpisode.size, sceneCount, groups }
}
