// 统一 loading 的阶段脚本（纯数据）。每个创作任务有一串阶段，weight 决定它占多长。
// 生成类动作必须有可见的过程（原则四）：时长跟工作量正相关，不许写死。
export interface Phase {
  label: string
  weight: number // 相对占比，决定这一阶段在总时长里的分配
}

export const PHASES = {
  split: [
    { label: '正在保存资产到项目资产库', weight: 1 },
    { label: '正在划分集与场', weight: 2 },
    { label: '正在拆分镜头', weight: 4 },
    { label: '正在生成分镜脚本', weight: 3 },
  ],
  resplitScene: [
    { label: '正在保存本次新资产', weight: 1 },
    { label: '正在重新拆分本场', weight: 4 },
    { label: '正在更新镜头引用', weight: 2 },
  ],
  resplitEp: [
    { label: '正在保存本次新资产', weight: 1 },
    { label: '正在重新拆分本集各场', weight: 4 },
    { label: '正在更新镜头引用', weight: 2 },
  ],
  replaceEp: [
    { label: '正在保存新资产', weight: 1 },
    { label: '正在替换本集镜头', weight: 4 },
    { label: '正在更新镜头引用', weight: 2 },
  ],
  appendParse: [
    { label: '正在解析续集原文', weight: 3 },
    { label: '正在检查尚未收录的资产', weight: 2 },
  ],
  appendApply: [
    { label: '正在保存新资产', weight: 1 },
    { label: '正在拆分新集镜头', weight: 4 },
  ],
  assetPrompt: [
    { label: '正在通读全剧原文', weight: 2 },
    { label: '正在生成提示词', weight: 3 },
  ],
  shotPrompt: [
    { label: '正在读取镜头内容与 @ 资产', weight: 1 },
    { label: '正在生成提示词', weight: 4 },
  ],
} satisfies Record<string, Phase[]>

export type PhaseKey = keyof typeof PHASES

/**
 * 总时长 = clamp(900 + cost * 130, 1500, 9000) ms。
 * 25 镜的拆分 ≈ 4.1s，8 镜的重拆 ≈ 1.9s，单镜提示词 ≈ 1.7s——大活儿明显更久。
 */
export function taskDuration(cost: number): number {
  return Math.min(9000, Math.max(1500, 900 + cost * 130))
}
