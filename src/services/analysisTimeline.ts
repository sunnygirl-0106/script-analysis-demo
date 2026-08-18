// 拆解过程演示的「时间线剧本」——纯数据，供 App 的揭示控制器与 AnalyzeHud 共用。
// seed 始终完整加载，这里只描述「呈现层」按什么节奏、揭示到哪一阶段。
// 节奏：电影感·舒缓，约 12 秒走完（用户指定），资产阶段依次扫过四类，拆解更完整。

import type { Tab } from '../store/useStore'

/** 空态点「导入剧本」后，模拟上传耗时（ms），随后进入 analyzing。 */
export const UPLOAD_MS = 950

/** revealStage 0..4 各自到达的时刻（相对 analyzing 起点，ms）。
 *  0 读取 / 1 集·场 / 2 本场剧本 / 3 分镜脚本 / 4 角色·服装·场景·道具。 */
export const STAGE_AT = [0, 1600, 3800, 6200, 9000] as const

/** 资产阶段（stage 4）依次扫过四类资产的时刻表 —— 让「提取角色·服装·场景·道具」逐类呈现，拆解更完整。 */
export const ASSET_TAB_AT: { tab: Tab; at: number }[] = [
  { tab: 'character', at: 9000 },
  { tab: 'costume', at: 9750 },
  { tab: 'location', at: 10500 },
  { tab: 'prop', at: 11250 },
]

/** 全部揭示完成、切到真实完整页的时刻（ms）。 */
export const DONE_AT = 12000

/** 进度条在各阶段的目标百分比（CSS 平滑过渡到该宽度）。 */
export const STAGE_PROGRESS = [6, 26, 46, 68, 88] as const

export type StepState = 'done' | 'active' | 'todo'

export interface ChecklistStep {
  label: string
  state: StepState
}

/** 依当前 revealStage 与是否已完成，推导四步 checklist 的点亮状态（对齐参考稿 2b）。 */
export function checklist(stage: number, done: boolean): ChecklistStep[] {
  const step = (label: string, doneAt: number, activeFrom: number, activeTo: number): ChecklistStep => {
    if (done || stage >= doneAt) return { label, state: 'done' }
    if (stage >= activeFrom && stage <= activeTo) return { label, state: 'active' }
    return { label, state: 'todo' }
  }
  return [
    step('读取文件', 1, 0, 0),
    step('划分集与场', 2, 1, 1),
    step('拆分镜头', 4, 2, 3),
    step('提取角色 · 服装 · 场景 · 道具', Infinity, 4, 4),
  ]
}
