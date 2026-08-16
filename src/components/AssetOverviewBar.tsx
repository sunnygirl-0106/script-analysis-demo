import type { Asset, AssetKind } from '../data/types'

export type AssetSort = 'first' | 'freq' | 'name'

export const SORT_LABEL: Record<AssetSort, string> = {
  first: '按首次出场',
  freq: '按出场次数',
  name: '按名称',
}

// 计数摘要（按 tab 变）：角色计造型套数、服装计被引用、道具计将生成/暂不生成。
// 排序选择器已上移到表头（见 AssetList），这里只负责底栏的一行统计。
export function AssetSummary({
  kind, list, allAssets,
}: {
  kind: AssetKind
  list: Asset[]
  allAssets: Record<string, Asset>
}) {
  const looks = Object.values(allAssets).filter((a) => a.kind === 'look')
  if (kind === 'character') {
    return <><b>{list.length}</b> 个角色 · <b>{looks.length}</b> 套角色造型 · 提示词改动只影响下一步出图</>
  }
  if (kind === 'costume') {
    return <><b>{list.length}</b> 件服装 · 已关联 <b>{looks.length}</b> 套角色造型</>
  }
  if (kind === 'location') return <><b>{list.length}</b> 个场景</>
  const out = list.filter((a) => !a.excluded).length
  const off = list.length - out
  return <><b>{list.length}</b> 件道具 · <b>{out}</b> 项将生成{off ? ` / ${off} 项暂不生成` : ''}</>
}
