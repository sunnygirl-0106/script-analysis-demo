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
  look: '角色造型',
}

// 与 theme.css 的四类实体色保持一致，供 JS 内联样式（挂载弹层等）取用。look 沿用角色紫。
// 直接引用 CSS 变量字符串——浏览器会在内联样式里解析，theme.css 是唯一颜色来源。
export const KIND_COLOR: Record<AssetKind, string> = {
  character: 'var(--role)',
  costume: 'var(--cloth)',
  location: 'var(--scene)',
  prop: 'var(--prop)',
  look: 'var(--role)',
}

// 「安静版」资产表格用的压暗类目色：保留四个色相，压低饱和与明度，只点一颗小圆点，
// 其余（名称 / 标签 / 数字）全走灰阶，把注意力留给提示词与后续要加的分镜脚本列。
// 令牌定义在 theme.css（--role-dim 等），取值对齐参考稿《资产提取清单.html》。
export const KIND_DOT: Record<AssetKind, string> = {
  character: 'var(--role-dim)',
  costume: 'var(--cloth-dim)',
  location: 'var(--scene-dim)',
  prop: 'var(--prop-dim)',
  look: 'var(--role-dim)',
}

// 镜头可挂载的类目（挂载选择器候选）：着装角色 / 场景 / 道具，外加 character 兜底（选择器不主动列）。
// 服装不参与挂载（决策 3b）。
export const MOUNT_KINDS: MountableKind[] = ['look', 'location', 'prop']
