// 对白 · 旁白的字符串 DSL 编解码。纯函数，不碰 UI。
//
// 数据仍以一行行字符串存在 shot.dialogue（不动数据模型），这里负责解析 ↔ 序列化。
// 从 DialogueCell 搬出来的：它本来就是纯逻辑，混在一个 595 行的组件里既难读也难单测。
//
// 说话人的口径：
//  - 下拉只列「本镜画面中的角色」（由 mounts 派生），外加一项「其他（未指定具体角色）」。
//  - 选「其他」进入行内自填：可以写人名，也可以写「画外音」「心里话」「电视里的播报」这类声音来源，
//    还可以留空。自填内容不进角色资产表、不出图。
//  - 说话人若恰好等于某个角色名、且该角色不在本镜画面中 → 展示层自动附一个只读的「画外」标记。
import type { Shot } from '../data/types'

export type DlgType = '台词' | '旁白'

export interface DlgLine {
  type: DlgType
  speaker: string
  text: string
}

/** 无主语的叙述音前缀 → 旁白 */
const VO_PREFIX = /^(旁白|字幕)$/
/** 有声音但说话人未知的前缀 → 台词 + 说话人留空（历史 bug：这些曾被一并吞成旁白并丢掉说话人） */
const UNKNOWN_PREFIX = /^(画外|画外音|独白|内心独白|内心|OS|V\.?O\.?)$/i

/**
 * 解析已有字符串为结构化行。尽量宽容：
 *  - 「」/『』 内为正文，其前为前缀；没有引号时以第一个 ：/: 切分。
 *  - 前缀里的括注（如「碎碎念」「门外喊声」）不丢，回填到正文开头。
 *  - 「旁白：」「字幕：」→ 旁白；「画外音：」「独白：」→ 台词但说话人留空（不再静默归为旁白）。
 *  - 纯「……」无前缀 → 台词，说话人留空。
 */
export function parseDialogue(raw: string): DlgLine[] {
  const t = (raw ?? '').trim()
  if (!t || t === '无') return []
  return t
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map<DlgLine>((line) => {
      // 拆前缀与正文
      const q = line.match(/^(.*?)[「『](.*)[」』]\s*$/)
      let prefix = q ? q[1] : ''
      let text = q ? q[2] : line
      if (!q) {
        const c = line.search(/[：:]/)
        if (c >= 0) {
          prefix = line.slice(0, c)
          text = line.slice(c + 1)
        }
      }
      prefix = prefix.trim().replace(/[：:]\s*$/, '').trim()
      text = text.trim()

      // 括注单独取出，回填到正文（如「苏可（碎碎念）：…」→ 说话人 苏可，正文「（碎碎念）…」）
      const notes = prefix.match(/[（(][^）)]*[)）]/g) ?? []
      const name = prefix.replace(/[（(][^）)]*[)）]/g, '').trim()
      if (notes.length) text = `${notes.join('')}${text}`

      if (VO_PREFIX.test(name)) return { type: '旁白', speaker: '', text }
      if (UNKNOWN_PREFIX.test(name)) return { type: '台词', speaker: '', text }
      return { type: '台词', speaker: name, text }
    })
}

/** 台词无说话人时不写前缀，回读仍是「台词 + 说话人留空」，不再落一个「？」进数据。 */
export function serializeDialogue(lines: DlgLine[]): string {
  return lines
    .filter((l) => l.text.trim() || l.speaker.trim())
    .map((l) => {
      if (l.type === '旁白') return `旁白：「${l.text}」`
      return l.speaker.trim() ? `${l.speaker}：「${l.text}」` : `「${l.text}」`
    })
    .join('\n')
}

/** 内容框的输入提示。 */
export function textHint(l: DlgLine): string {
  if (l.type === '旁白') return '输入旁白内容'
  return '输入台词内容'
}

/**
 * 全剧用过的说话人（去重）。**按 shots 对象引用记忆化**：
 * 分镜表一屏 25 个对白格，每个都要知道「以前自填过哪些说话人」才能填下拉，
 * 各算各的就是 25 次全剧解析。这里让它们共用一次。
 */
const speakerCache = new WeakMap<object, string[]>()

export function usedSpeakers(shots: Record<string, Shot>): string[] {
  const cached = speakerCache.get(shots)
  if (cached) return cached
  const set = new Set<string>()
  for (const sh of Object.values(shots)) {
    for (const l of parseDialogue(sh.dialogue)) {
      if (l.type === '台词' && l.speaker) set.add(l.speaker)
    }
  }
  const out = [...set]
  speakerCache.set(shots, out)
  return out
}
