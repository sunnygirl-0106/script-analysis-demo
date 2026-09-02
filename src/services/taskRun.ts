// 统一 loading 的阶段脚本（纯数据）。每个创作任务有一串阶段，weight 决定它占多长。
// 生成类动作必须有可见的过程（原则四）：时长跟工作量正相关，不许写死。
export interface Phase {
  label: string
  weight: number // 相对占比，决定这一阶段在总时长里的分配
}

export const PHASES = {
  // 步骤①「开始整理」（v2.5 §4.2）：读原文 → 切集 → 数字数。整页动效，跑完落整理剧本页。
  organize: [
    { label: '正在读取剧本', weight: 2 },
    { label: '研读剧本中，整理剧本内容', weight: 3 },
    { label: '正在识别剧集边界', weight: 3 },
    { label: '正在统计字数', weight: 2 },
  ],
  // 步骤②「确认集数并提取资产」（v2.5 §4.2）：只提取资产。划分集与场不在这里——
  // 集已在整理那一步分好，场要等步骤③「开始拆分」才产生。
  extract: [
    { label: '正在通读已整理的剧本', weight: 2 },
    { label: '正在提取角色 · 服装 · 场景 · 道具', weight: 3 },
    { label: '正在生成资产提示词', weight: 2 },
  ],
  // 步骤③「确认并开始拆分」（v2.5 §4.2）：场与镜在这里才被创建。入库已在步骤②完成。
  // 第一句的节奏名由 splitPhases() 填上——动效里要让用户看见自己刚选的那一档。
  split: [
    { label: '正在划分场次', weight: 2 },
    { label: '正在拆分镜头', weight: 4 },
    { label: '正在生成分镜脚本', weight: 3 },
  ],
  resplitScene: [
    { label: '正在重新拆分本场', weight: 4 },
    { label: '正在更新镜头引用', weight: 2 },
  ],
  resplitEp: [
    { label: '正在重新拆分本集各场', weight: 4 },
    { label: '正在更新镜头引用', weight: 2 },
  ],
  // 「上传文件 · 解析新集」弹窗里的整理（v2.5 §5.1）：只读原文、切集，不提取资产（那是页脚那一步）。
  appendParse: [
    { label: '正在读取续集原文', weight: 3 },
    { label: '正在识别剧集边界', weight: 2 },
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

/** 拆分阶段文案：把用户刚选的节奏名填进第一句。 */
export function splitPhases(densityLabel: string): Phase[] {
  return PHASES.split.map((p, i) =>
    i === 0 ? { ...p, label: `正在按「${densityLabel}」节奏划分场次` } : p,
  )
}

/**
 * 总时长 = clamp(900 + cost * 130, 1500, 9000) ms。
 * 25 镜的拆分 ≈ 4.1s，8 镜的重拆 ≈ 1.9s，单镜提示词 ≈ 1.7s——大活儿明显更久。
 */
export function taskDuration(cost: number): number {
  return Math.min(9000, Math.max(1500, 900 + cost * 130))
}
