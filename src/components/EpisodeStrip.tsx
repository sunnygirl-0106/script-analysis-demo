import type { Appearance } from '../data/types'
import s from './AssetList.module.css'

// 出场迷你集条：一格一集，有出场填 accent、无出场填 --line2。
// 这是剧本分析相对资产库唯一的信息优势可视化 —— 60 集短剧里一眼分辨「全剧常驻」和「只在前三集」。
export function EpisodeStrip({ totalEpisodes, appearances }: { totalEpisodes: number; appearances: Appearance[] }) {
  const hit = new Set(appearances.map((a) => a.episodeNo))
  const dense = totalEpisodes > 40 // 集数多时格宽降到 3px 并去掉 gap
  return (
    <span className={[s.strip, dense ? s.stripDense : ''].join(' ')} title={`共 ${totalEpisodes} 集，出场 ${hit.size} 集`}>
      {Array.from({ length: totalEpisodes }, (_, i) => (
        <i key={i} className={[s.cell, hit.has(i + 1) ? s.cellOn : ''].join(' ')} />
      ))}
    </span>
  )
}
