import { useStore } from '../store/useStore'
import type { Asset, Look } from '../data/types'
import { can } from '../services/capability'
import { looksOfCharacter } from '../services/looks'
import s from './LookMountControl.module.css'

// 造型手动挂载（v2.0 §6.4，editLookBinding 放开后）。角色行给「＋ 服装」，造型(look)行给「换服装 / 解除造型」。
// 只在 analysis 阶段（can editLookBinding）出现；visual 阶段隐藏（绑定移交下游）。
export function LookMountControl({ asset }: { asset: Asset }) {
  const canEdit = useStore((st) => can(st.project, 'editLookBinding'))
  const assets = useStore((st) => st.project.assets)
  const setLookCostumes = useStore((st) => st.setLookCostumes)
  const createLook = useStore((st) => st.createLook)

  if (!canEdit) return null
  const costumes = Object.values(assets).filter((a) => a.kind === 'costume')

  // 角色行：没有造型时给「＋ 服装」新建一个着装角色；已有造型的角色，控制交给其 look 子行。
  if (asset.kind === 'character') {
    if (looksOfCharacter(asset.id, assets).length > 0) return null
    return (
      <select
        className={s.sel}
        value=""
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => { if (e.target.value) createLook(asset.id, [e.target.value]) }}
      >
        <option value="" disabled>＋ 服装</option>
        {costumes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    )
  }

  // 造型(look)行：换服装（单选 costume，"默认着装" = 空）+ 解除造型（清空 costume）。
  if (asset.kind === 'look') {
    const look = asset as Look
    return (
      <span className={s.wrap} onClick={(e) => e.stopPropagation()}>
        <select
          className={s.sel}
          value={look.costumeIds[0] ?? ''}
          onChange={(e) => setLookCostumes(look.id, e.target.value ? [e.target.value] : [])}
          title="换服装"
        >
          <option value="">默认着装</option>
          {costumes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {look.costumeIds.length > 0 && (
          <button
            className={s.unbind}
            title="解除造型（回落到默认着装）"
            onClick={() => setLookCostumes(look.id, [])}
          >
            解除造型
          </button>
        )}
      </span>
    )
  }

  return null
}
