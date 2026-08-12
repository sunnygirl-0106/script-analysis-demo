import type { Asset, AssetKind } from '../data/types'
import s from './AssetList.module.css'

export type AssetSort = 'first' | 'freq' | 'name'

const SORT_LABEL: Record<AssetSort, string> = {
  first: '按首现早晚',
  freq: '按出场频次',
  name: '按名称',
}

// 概览条：按 tab 变的一行统计 + 排序选择器（首现排序是排产依据，必须是默认项，决策 6.4）。
export function AssetOverviewBar({
  kind, list, allAssets, sort, onSort,
}: {
  kind: AssetKind
  list: Asset[]
  allAssets: Record<string, Asset>
  sort: AssetSort
  onSort: (s: AssetSort) => void
}) {
  const summary = (() => {
    const looks = Object.values(allAssets).filter((a) => a.kind === 'look')
    if (kind === 'character') {
      const by = (r: string) => list.filter((a) => a.kind === 'character' && a.role === r).length
      return `角色 ${list.length} 项 · 着装角色 ${looks.length} 项 · 主角${by('lead')} 配角${by('support')} 龙套${by('extra')}`
    }
    if (kind === 'costume') return `服装 ${list.length} 件 · 被 ${looks.length} 个着装角色使用`
    if (kind === 'location') return `场景 ${list.length} 个`
    const out = list.filter((a) => !a.excluded).length
    const off = list.length - out
    return `道具 ${list.length} 件 · ${out} 项将出图${off ? ` / ${off} 项不出图` : ''}`
  })()

  return (
    <div className={s.overview}>
      <span className={s.ovText}>{summary}</span>
      <span className={s.ovRight}>
        <select className={s.sortSel} value={sort} onChange={(e) => onSort(e.target.value as AssetSort)}>
          {(['first', 'freq', 'name'] as AssetSort[]).map((k) => (
            <option key={k} value={k}>{SORT_LABEL[k]}</option>
          ))}
        </select>
      </span>
    </div>
  )
}
