// 《最后的尊严 · 逐镜提示词完全版》46 镜的 image / video 扩写。
// 单条提示词较长，按 shot 拆到分文件，这里合并导出 PROMPTS，供 seed / shotPresets 生成点注入。
// 只承载 imagePrompt / videoPrompt 两字段；缺条目时由 seed 里的一句话提示词兜底。
import { ep1s1 } from './ep1s1'
import { ep1s2 } from './ep1s2'
import { ep1s3 } from './ep1s3'
import { s1Compact } from './s1Compact'
import { s1Loose } from './s1Loose'
import { ep2 } from './ep2'

export interface ShotPrompt {
  image: string
  video: string
}

export const PROMPTS: Record<string, ShotPrompt> = {
  ...ep1s1,
  ...ep1s2,
  ...ep1s3,
  ...s1Compact,
  ...s1Loose,
  ...ep2,
}
