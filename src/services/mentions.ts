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

// ── 词表编译（共享原语）────────────────────────────────────────────────
//
// 全仓库有四处要做同一件事：把一组「词」编译成正则、把文本切成「命中 / 未命中」交替段。
// 以前是四份各自 for-flatMap-sort-escape-new RegExp 的复制品，且都在渲染路径上，
// 每个 EntityText 实例、每个剧本自然段各建一次。这里收成一份，并按词表来源记忆化。

export interface Matcher<T> {
  /** 带捕获组的 alternation 正则，可直接 text.split(re)。 */
  re: RegExp
  /** 词 → 载荷。取代此前 terms.find(t => t.term === part) 的线性扫描。 */
  byTerm: Map<string, T>
}

/**
 * 把 [词, 载荷] 编译成「长词优先」的匹配器。只收长度 ≥ 2 的词。
 * 长词优先由排序 + 正则最左优先共同保证：「外卖员」排在「外卖」前面，
 * 所以不会被切成「外卖」+「员」；「苏可可」也不会被「苏可」吃掉。
 * 一个词都没有时返回 null，调用方据此走「原样返回、不高亮」的快路。
 */
export function compileTerms<T>(entries: Iterable<readonly [string, T]>): Matcher<T> | null {
  const byTerm = new Map<string, T>()
  for (const [term, payload] of entries) {
    if (term && term.length >= 2 && !byTerm.has(term)) byTerm.set(term, payload)
  }
  if (byTerm.size === 0) return null
  const escaped = [...byTerm.keys()]
    .sort((a, b) => b.length - a.length)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  return { re: new RegExp(`(${escaped.join('|')})`, 'g'), byTerm }
}

/**
 * 资产词表：编目名 + 剧本别名，长词优先。**按 assets 的对象引用记忆化**，
 * 所以一次编辑只编译一次，而不是每个订阅者各编译一次。
 *
 * 编目名（智能手机）常与正文口语（手机）对不上，所以两者都要参与匹配，
 * 否则「手机」连不到「智能手机」那张 chip。
 *
 * look（角色造型）不进词表：它的名字是「角色 · 服装」派生出来的，正文里不会这么写。
 * 正文写的是角色名，由 relatedAssetIds() 把角色 → 造型接上。
 */
const assetMatcherCache = new WeakMap<object, Matcher<Asset> | null>()

export function assetMatcher(assets: Record<string, Asset>): Matcher<Asset> | null {
  const cached = assetMatcherCache.get(assets)
  if (cached !== undefined) return cached
  const m = compileTerms<Asset>(
    Object.values(assets)
      .filter((a) => a.kind !== 'look')
      .flatMap((a) => [a.name, ...(a.aliases ?? [])].map((term) => [term, a] as const)),
  )
  assetMatcherCache.set(assets, m)
  return m
}

export interface Mention {
  text: string
  /** 命中词表时带上资产 id；纯文本段不带。 */
  assetId?: string
}

/** 把一段文本切成「纯文本段 / 实体段」交替的序列，供 EntityText 渲染。 */
export function splitMentions(text: string, assets: Record<string, Asset>): Mention[] {
  if (!text) return []
  const m = assetMatcher(assets)
  if (!m) return [{ text }]
  return text
    .split(m.re)
    .filter((part) => part !== '')
    .map((part) => {
      const hit = m.byTerm.get(part)
      return hit ? { text: part, assetId: hit.id } : { text: part }
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
