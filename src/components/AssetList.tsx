import { useState } from 'react'
import { useStore } from '../store/useStore'
import type { Asset, AssetKind } from '../data/types'
import { looksOfCharacter } from '../services/looks'
import { AssetRow } from './AssetRow'
import { type AssetSort } from './AssetOverviewBar'
import { PromptDialog } from './PromptDialog'
import s from './AssetList.module.css'

// 资产提取清单「安静版」：四类共用一张紧凑可滚动表格（圆点 / 名称 / 提示词 / 出场）。
// 类目色只留一颗小圆点，其余走灰阶；角色行下展开其造型(look)子行；点行在旁边弹浮层改提示词。
// 排序由上层工具栏控制并传入，本组件不再自带顶栏。
export function AssetList({ kind, sort }: { kind: AssetKind; sort: AssetSort }) {
  const assets = useStore((st) => st.project.assets)
  const usageIndex = useStore((st) => st.usageIndex())
  const [pop, setPop] = useState<{ assetId: string; anchor: DOMRect } | null>(null)

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

  // 扁平行：角色行 + 其造型(look)子行；其余类目平铺。角色不再封顶，整表可滚动。
  const rows: { asset: Asset; sub?: boolean }[] = []
  for (const a of sorted) {
    rows.push({ asset: a })
    if (kind === 'character') {
      for (const lk of looksOfCharacter(a.id, assets)) rows.push({ asset: lk, sub: true })
    }
  }

  const openPrompt = (assetId: string, rowEl: HTMLElement) =>
    setPop({ assetId, anchor: rowEl.getBoundingClientRect() })

  return (
    <div className={s.panel}>
      {/* 滚动体：sticky 列头 + 行 */}
      <div className={s.body}>
        <div className={[s.colHead, s.grid4].join(' ')}>
          <span />
          <span>名称</span>
          <span>提示词 · 点行编辑</span>
          <span />
          <span>出场</span>
          <span>状态</span>
        </div>
        {rows.map(({ asset, sub }) => (
          <AssetRow key={asset.id} asset={asset} sub={sub} onOpenPrompt={openPrompt} />
        ))}
      </div>

      {pop && (
        <PromptDialog assetId={pop.assetId} anchor={pop.anchor} onClose={() => setPop(null)} />
      )}
    </div>
  )
}
