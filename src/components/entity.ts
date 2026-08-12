// 实体类型 → chip 样式类名 / 中文标签的映射。
import type { AssetKind, MountableKind } from '../data/types'
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
    case 'look':
      return ui.chipRole! // 着装角色沿用角色紫，chip 内以「角色名 · 服装名」自证
  }
}

export const KIND_LABEL: Record<AssetKind, string> = {
  character: '角色',
  costume: '服装',
  location: '场景',
  prop: '道具',
  look: '着装角色',
}

// 与 theme.css 的四类实体色保持一致，供 JS 内联样式（挂载弹层等）取用。look 沿用角色紫。
export const KIND_COLOR: Record<AssetKind, string> = {
  character: '#a78bfa',
  costume: '#f472b6',
  location: '#34d399',
  prop: '#fbbf24',
  look: '#a78bfa',
}

// 四类基础资产的固定顺序（资产 tab / 概览遍历用）。
export const KIND_ORDER: AssetKind[] = ['character', 'costume', 'location', 'prop']

// 镜头可挂载的类目（挂载选择器候选）：着装角色 / 场景 / 道具，外加 character 兜底（选择器不主动列）。
// 服装不参与挂载（决策 3b）。
export const MOUNT_KINDS: MountableKind[] = ['look', 'location', 'prop']
