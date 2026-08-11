import { useStore } from '../store/useStore'
import type { AssetKind } from '../data/types'
import { AssetCard } from './AssetCard'
import s from './AssetGrid.module.css'

const NOTE: Partial<Record<AssetKind, string>> = {
  character: '纯白背景三视图（正 / 侧 / 背全身站姿）+ 特写。角色下方的服装 chip 是「谁穿哪件」的关系视图。',
  costume: '纯白背景平铺 / 挂拍，正背两面，无人物 —— 与角色三视图分开生成，再融合成定妆图。只列剧本里真实出现的组合，不做全排列。',
  location: '同一空间不同时段各生一张，否则拍摄台挂载时光线对不上。',
  prop: '只提取会被镜头单独交代的物件，纯白背景产品图。',
}

// 资产卡片网格，三类共用。character 展示服装 + 不生图开关；prop 展示次要开关。
export function AssetGrid({ kind }: { kind: AssetKind }) {
  const assets = useStore((st) => st.project.assets)
  const list = Object.values(assets).filter((a) => a.kind === kind)

  return (
    <div className={s.scroll} style={{ overflow: 'auto', flex: 1, padding: '12px 18px 22px' }}>
      <div className={s.grid}>
        {list.map((a) => (
          <AssetCard key={a.id} asset={a} />
        ))}
      </div>
      {NOTE[kind] && <div className={s.note}>{NOTE[kind]}</div>}
    </div>
  )
}
