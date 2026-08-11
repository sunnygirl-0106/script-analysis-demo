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

// 与 theme.css 的四类实体色保持一致，供 JS 内联样式（挂载弹层等）取用。
export const KIND_COLOR: Record<AssetKind, string> = {
  character: '#a78bfa',
  costume: '#f472b6',
  location: '#34d399',
  prop: '#fbbf24',
}

export const KIND_ORDER: AssetKind[] = ['character', 'costume', 'location', 'prop']
