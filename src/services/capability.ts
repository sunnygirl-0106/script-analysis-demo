// 能力矩阵：替代一刀切的阶段锁（决策 1a/1b）。纯函数。
// 规则版本：v1.2（2026-08-12）。断言见 tests/rules.test.ts 的 R6。
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
  | 'editLookBinding'   // 改 look 的 characterId / costumeIds
  | 'toggleExcluded'    // 切换「不出图」

const MATRIX: Record<Capability, (p: Project) => boolean> = {
  // 决策 1a：进入视觉筹备后仍可改
  editPrompt:     () => true,
  editScript:     () => true,
  editShotFields: () => true,
  editMounts:     () => true,
  editSceneTrack: () => true,

  // 决策 1b：绑定关系由 AI 决定，任何阶段都不可改。
  // 保留这个恒假的键，是为了让 UI 有统一的地方查「为什么这个 chip 不能删」并渲染解释文案，
  // 一个恒假的能力位比散落各处的硬编码禁用更好维护。
  editLookBinding: () => false,

  // 名称的真相源在进入资产库后移交下游，避免与资产库的「库内同名唯一」撞车。
  editAssetName:  (p) => p.stage === 'analysis',
  // 出图队列一旦开跑，排除与否由资产库那边处理。
  toggleExcluded: (p) => p.stage === 'analysis',
}

export function can(project: Project, cap: Capability): boolean {
  return MATRIX[cap](project)
}
