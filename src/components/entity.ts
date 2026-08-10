// 实体类型 → chip 样式类名 / 中文标签的映射。
import type { AssetKind } from '../data/types'
import ui from '../styles/ui.module.css'

export function chipClass(kind: AssetKind): string {
  switch (kind) {
    case 'character':
      return ui.chipRole!
    case 'costume':
      return ui.chipCloth!
    case 'location':
      return ui.chipScene!
    case 'prop':
      return ui.chipProp!
  }
}

export const KIND_LABEL: Record<AssetKind, string> = {
  character: '角色',
  costume: '服装',
  location: '场景',
  prop: '道具',
}
