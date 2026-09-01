// 能力矩阵：替代一刀切的阶段锁（决策 1a/1b）。纯函数。
// 规则版本：v2.0（2026-09-01）。断言见 tests/rules.test.ts 的 R6 / R8。
//
// 为什么不再用 canEdit(project, stage)：进入视觉筹备后仍要能改提示词和剧本（决策 1a），
// 全局锁与此直接冲突。改成字段级 can(project, capability)，每种编辑各自表态。
import type { Project } from '../data/types'

export type Capability =
  | 'editPrompt'        // 改任意资产的 imagePrompt
  | 'editScript'        // 导入 / 重拆 / 追加集 / 替换集 / 删集
  | 'editShotFields'    // 改镜头字段：景别 / 焦段 / 时长 / 画面描述 / 对白…
  | 'editMounts'        // 增删镜头挂载
  | 'editSceneTrack'    // 场级设定：情绪 / 配乐
  | 'editAssetName'     // 改资产名称 / 别名
  | 'editLookBinding'   // 手动挂载造型：改 look 的 characterId / costumeIds
  | 'toggleExcluded'    // 切换「不出图」
  | 'replaceWholeScript' // ★ v2.0：整本替换（仅首次入库前可用）

const MATRIX: Record<Capability, (p: Project) => boolean> = {
  // 决策 1a：进入视觉筹备后仍可改
  editPrompt:     () => true,
  editScript:     () => true,
  editShotFields: () => true,
  editMounts:     () => true,
  editSceneTrack: () => true,

  // v2.0：造型手动挂载已拍板可做（推翻决策 1b）。名称同理，真相源在 analysis 阶段。
  // UI 据此渲染角色行的「＋ 服装 / 换服装 / 解除造型」三个入口；visual 阶段不再改绑定。
  editLookBinding: (p) => p.stage === 'analysis',

  // 名称的真相源在进入资产库后移交下游，避免与资产库的「库内同名唯一」撞车。
  editAssetName:  (p) => p.stage === 'analysis',
  // 出图队列一旦开跑，排除与否由资产库那边处理。
  toggleExcluded: (p) => p.stage === 'analysis',

  // v3 R7：首次入库前允许整本替换（此时库里一条都没写，零副作用）；
  // 一旦入过库，换一部剧本请新建项目。
  replaceWholeScript: (p) => p.libraryCommittedAt == null,
}

export function can(project: Project, cap: Capability): boolean {
  return MATRIX[cap](project)
}
