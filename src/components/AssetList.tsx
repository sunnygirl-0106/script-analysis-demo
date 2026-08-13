import { useState } from 'react'
import { useStore } from '../store/useStore'
import type { AssetKind } from '../data/types'
import { AssetRow } from './AssetRow'
import { AssetOverviewBar, type AssetSort } from './AssetOverviewBar'
import { PromptDialog } from './PromptDialog'
import s from './AssetList.module.css'

// 资产条目流（单列横向 row，区别于资产库的方图网格，决策 6.1）。四类共用，按 kind 分支渲染。
export function AssetList({ kind }: { kind: AssetKind }) {
  const assets = useStore((st) => st.project.assets)
  const usageIndex = useStore((st) => st.usageIndex())
  const [sort, setSort] = useState<AssetSort>('first') // 首现排序是排产依据，默认项
  const [promptAsset, setPromptAsset] = useState<string | null>(null)

  const list = Object.values(assets).filter((a) => a.kind === kind)

  const sorted = [...list].sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name, 'zh')
    if (sort === 'freq') return (usageIndex[b.id]?.shotCount ?? 0) - (usageIndex[a.id]?.shotCount ?? 0)
    // first：按首现（集 → 场）升序，未出场排最后
    const fa = usageIndex[a.id]?.firstAppearance
    const fb = usageIndex[b.id]?.firstAppearance
    if (!fa && !fb) return 0
    if (!fa) return 1
    if (!fb) return -1
    return fa.episodeNo - fb.episodeNo || fa.sceneNo - fb.sceneNo
  })

  // 角色：合并角色 + 造型的大卡，纵向铺开，最多显示 6 个（决策：角色只看前 6）。
  // 服装 / 场景 / 道具：中性卡片网格。
  const isChar = kind === 'character'
  const CHAR_CAP = 6
  const shown = isChar ? sorted.slice(0, CHAR_CAP) : sorted
  const containerCls = isChar
    ? s.list
    : [s.grid, kind === 'prop' ? s.gridProp : ''].join(' ')

  return (
    <div className={s.scroll}>
      <AssetOverviewBar kind={kind} list={list} allAssets={assets} sort={sort} onSort={setSort} />
      <div className={containerCls}>
        {shown.map((a) => (
          <AssetRow key={a.id} asset={a} onOpenPrompt={setPromptAsset} />
        ))}
      </div>
      {isChar && sorted.length > CHAR_CAP && (
        <div className={s.moreHint}>仅显示前 {CHAR_CAP} 个角色（共 {sorted.length} 个）</div>
      )}
      {promptAsset && <PromptDialog assetId={promptAsset} onClose={() => setPromptAsset(null)} />}
    </div>
  )
}
