import type { Asset, AssetKind } from '../data/types'
import s from './AssetList.module.css'

export type AssetSort = 'first' | 'freq' | 'name'

const SORT_LABEL: Record<AssetSort, string> = {
  first: '按首次出场',
  freq: '按出场次数',
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
      return <><b>{list.length}</b> 个角色 · 共 <b>{looks.length}</b> 套角色造型</>
    }
    if (kind === 'costume') return <><b>{list.length}</b> 件服装 · 被 <b>{looks.length}</b> 套角色造型使用</>
    if (kind === 'location') return <><b>{list.length}</b> 个场景</>
    const out = list.filter((a) => !a.excluded).length
    const off = list.length - out
    return <><b>{list.length}</b> 件道具 · <b>{out}</b> 项将生成{off ? ` / ${off} 项暂不生成` : ''}</>
  })()

  return (
    <div className={s.overview}>
      <span className={s.ovText}>{summary}</span>
      <span className={s.ovRight}>
        <span className={s.ovSortLabel}>排序</span>
        <select className={s.sortSel} value={sort} onChange={(e) => onSort(e.target.value as AssetSort)}>
          {(['first', 'freq', 'name'] as AssetSort[]).map((k) => (
            <option key={k} value={k}>{SORT_LABEL[k]}</option>
          ))}
        </select>
      </span>
    </div>
  )
}
