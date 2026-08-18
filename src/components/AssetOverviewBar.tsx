export type AssetSort = 'first' | 'freq' | 'name'

export const SORT_LABEL: Record<AssetSort, string> = {
  first: '按首次出场',
  freq: '按出场次数',
  name: '按名称',
}
