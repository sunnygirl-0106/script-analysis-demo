// 实体类型 → chip 样式类名 / 中文标签的映射。
import type { AssetKind } from '../data/types'
import ui from '../styles/ui.module.css'

import type { MountKind } from '../data/types'

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
    case 'look':
      return ui.chipLook!
  }
}

export const KIND_LABEL: Record<AssetKind, string> = {
  character: '角色',
  costume: '服装',
  location: '场景',
  prop: '道具',
  look: '着装角色',
}

// 与 theme.css 的实体色保持一致，供 JS 内联样式（挂载弹层等）取用。
export const KIND_COLOR: Record<AssetKind, string> = {
  character: '#a78bfa',
  costume: '#f472b6',
  location: '#34d399',
  prop: '#fbbf24',
  look: '#38bdf8',
}

// 资产页四个 Tab 的顺序（不含 look，着装角色不单独成 Tab）。
export const KIND_ORDER: AssetKind[] = ['character', 'costume', 'location', 'prop']
// 分镜挂载可选的三类（着装角色 / 场景 / 道具，不含独立服装）。
export const MOUNT_KINDS: MountKind[] = ['look', 'location', 'prop']
