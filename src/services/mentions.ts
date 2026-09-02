// 「文本 ↔ 资产」对账层。
//
// 底座仍是一条产品决策：**主要内容默认是纯文本，散文里的名字就是普通汉字。**
// 挂载列（Shot.mounts，存 id）是「这一镜有谁」的唯一结构化真相；
// 主要内容 / 光影 / 对白 / 音效 / 提示词平时都只是散文，靠文本匹配与资产**对账**（不是挂载）。
//
// 对账结果服务两件事：
//   1. hover 联动：hover 主要内容里的名字 → 高亮「出场的人和物」里对应那一项
//   2. 缺挂载告警：services/completeness.ts
//
// 唯一的例外是用户**主动** @ 引用：在编辑框输入 @ 选中资产（见 AtMentionPicker），
// 会把资产名插进正文并顺手 addMount 挂到本镜 —— 这一下是用户明确建的边，不违背「默认纯文本」。
//
// 好处是真相只有一处，不会「两个真相打架」；坏处是改名后正文不会自动跟着变。
import type { Asset } from '../data/types'

// ── 词表 ────────────────────────────────────────────────────────────────

interface Term {
  term: string
  assetId: string
}

/**
 * 匹配词表：编目名 + 剧本别名，长词优先，只取长度 ≥ 2 的词。
 * 口径与 ScriptPanel 的原文高亮一致 —— 编目名（智能手机）常与正文口语（手机）对不上，
 * 所以两者都要参与匹配，否则「手机」连不到「智能手机」这张 chip。
 *
 * look（角色造型）不进词表：它的名字是从「角色 · 服装」派生出来的，正文里不会这么写。
 * 正文里写的是角色名，由 relatedAssetIds() 把角色 → 造型接上。
 */
function buildTerms(assets: Record<string, Asset>): Term[] {
  return Object.values(assets)
    .filter((a) => a.kind !== 'look')
    .flatMap((a) => [a.name, ...(a.aliases ?? [])].map((term) => ({ term, assetId: a.id })))
    .filter((t) => t.term && t.term.length >= 2)
    .sort((a, b) => b.term.length - a.term.length)
}

export interface Mention {
  text: string
  /** 命中词表时带上资产 id；纯文本段不带。 */
  assetId?: string
}

/**
 * 把一段文本切成「纯文本段 / 实体段」交替的序列，供 EntityText 渲染。
 * 长词优先靠 buildTerms 的排序 + 正则 alternation 的最左优先共同保证
 * （「外卖员」排在「外卖」前面，所以不会被切成「外卖」+「员」）。
 */
export function splitMentions(text: string, assets: Record<string, Asset>): Mention[] {
  if (!text) return []
  const terms = buildTerms(assets)
  if (terms.length === 0) return [{ text }]
  const escaped = terms.map((t) => t.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`(${escaped.join('|')})`, 'g')
  return text
    .split(re)
    .filter((part) => part !== '')
    .map((part) => {
      const hit = terms.find((t) => t.term === part)
      return hit ? { text: part, assetId: hit.assetId } : { text: part }
    })
}

/**
 * 一个资产「牵连到」哪些资产 id —— hover 高亮要顺着引用关系走一跳。
 *
 * 正文里写的是「苏可」（character），但「出场的人和物」里挂的是「苏可 · 宽松连帽卫衣」（look）。
 * 不做这一跳，hover 角色名就什么都不亮，联动等于没做。
 */
export function relatedAssetIds(assetId: string, assets: Record<string, Asset>): Set<string> {
  const out = new Set<string>([assetId])
  const a = assets[assetId]
  if (!a) return out
  // 造型 → 它的角色与服装
  if (a.kind === 'look') {
    out.add(a.characterId)
    a.costumeIds.forEach((id) => out.add(id))
  }
  // 角色 / 服装 → 用到它的造型
  for (const x of Object.values(assets)) {
    if (x.kind !== 'look') continue
    if (x.characterId === assetId || x.costumeIds.includes(assetId)) out.add(x.id)
  }
  return out
}

// ── 改名影响面 ──────────────────────────────────────────────────────────
