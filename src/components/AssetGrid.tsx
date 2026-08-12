import { useStore } from '../store/useStore'
import type { AssetKind } from '../data/types'
import { AssetCard } from './AssetCard'
import s from './AssetGrid.module.css'

const NOTE: Partial<Record<AssetKind, string>> = {
  character: '角色素模的纯白三视图 + 特写。卡片下方「着装角色」是该角色 × 服装的固定组合，关系锁定只读，提示词各自可编辑。',
  costume: '独立生产的基础服装（第一批下发），不直接进分镜。同一件可被 0 / 1 / 多个着装角色引用，人物参考走着装角色。',
  location: '同一空间不同时段各一张，「客厅日」「客厅夜」是两份独立资产，本轮不做时段合并。',
  prop: '只提取会被镜头单独交代的物件，纯白背景产品图。',
}

// 资产卡片网格，四类共用。character 展示其着装角色；costume 反查被哪些着装角色引用。
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
