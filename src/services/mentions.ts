// 「文本 ↔ 资产」对账层。
//
// 底座仍是一条产品决策：**主要内容默认是纯文本，散文里的名字就是普通汉字。**
// 挂载列（Shot.mounts，存 id）是「这一镜有谁」的唯一结构化真相；
// 主要内容 / 光影 / 对白 / 音效 / 提示词平时都只是散文，靠文本匹配与资产**对账**（不是挂载）。
//
// 对账结果服务三件事：
//   1. hover 联动：hover 主要内容里的名字 → 高亮「出场的人和物」里对应那一项
//   2. 缺挂载告警：services/completeness.ts（已有）
//   3. 改名时的替换候选：scanRenameImpact()
//
// 唯一的例外是用户**主动** @ 引用：在编辑框输入 @ 选中资产（见 AtMentionPicker），
// 会把资产名插进正文并顺手 addMount 挂到本镜 —— 这一下是用户明确建的边，不违背「默认纯文本」。
//
// 好处是真相只有一处，不会「两个真相打架」；坏处是改名后正文不会自动跟着变 ——
// 这正是 scanRenameImpact + renameAssetWithSync 要补的那一刀。
import type { Asset, PromptState, Project, Shot } from '../data/types'

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

/** 会被「同步替换」波及的散文字段。剧本原文（Scene.rawText）**永不参与** —— 原文只读，一字不改。 */
export const PROSE_FIELDS: { field: keyof Shot; label: string }[] = [
  { field: 'sourceQuote', label: '主要内容' },
  { field: 'title', label: '镜头摘要' },
  { field: 'lighting', label: '光影氛围' },
  { field: 'dialogue', label: '对白' },
  { field: 'sfx', label: '音效' },
]

export interface RenameHit {
  /** 「镜 3 · 主要内容」这类定位串 */
  where: string
  /** 命中前后各留一点上下文的片段，用于逐条 diff */
  before: string
  after: string
}

export interface RenameImpact {
  /** 引用侧：改一个字段就自动跟随，不需要用户确认。这里只是给用户看清影响面。 */
  autoBits: string[]
  /** 散文字段命中（主要内容 / 摘要 / 光影 / 对白 / 音效） */
  prose: RenameHit[]
  /** 按字段类型聚合的计数，用于「主要内容 8 · 对白 5」这行小字 */
  proseByLabel: { label: string; count: number }[]
  /** 已生成提示词命中（按镜聚合，一镜算一条） */
  shotPrompts: RenameHit[]
  /** 资产生图提示词命中（角色 / 造型 / 服装 / 场景 / 道具 各自的 imagePrompt） */
  assetPrompts: RenameHit[]
}

function snippet(text: string, at: number, oldName: string, newName: string): { before: string; after: string } {
  const a = Math.max(0, at - 14)
  const b = Math.min(text.length, at + oldName.length + 18)
  const head = (a > 0 ? '…' : '') + text.slice(a, at)
  const tail = text.slice(at + oldName.length, b) + (b < text.length ? '…' : '')
  return { before: head + oldName + tail, after: head + newName + tail }
}

function firstHit(text: string, oldName: string): number {
  return text ? text.indexOf(oldName) : -1
}

function countOf(text: string, oldName: string): number {
  if (!text || !oldName) return 0
  return text.split(oldName).length - 1
}

/** 一条镜头的提示词文本（画面 + 视频）。 */
function shotPromptText(shot: Shot): string {
  return `${shot.imagePrompt ?? ''}\n${shot.videoPrompt ?? ''}`
}

/**
 * 扫一遍全剧，算出「把 assetId 的名字从旧改成新」会波及到哪些地方。
 * 纯函数，不改任何东西 —— 弹窗拿它渲染计数与 diff，store 拿它判断要不要标待更新。
 *
 * 只匹配**当前编目名**，不匹配别名：正文里的「手机」「沙发」是取材自剧本原文的口语称呼，
 * 保留原样比强行改成编目名更自然。
 */
export function scanRenameImpact(
  project: Project,
  promptStates: Record<string, PromptState>,
  assetId: string,
  newName: string,
): RenameImpact {
  const asset = project.assets[assetId]
  const oldName = asset?.name ?? ''
  const empty: RenameImpact = {
    autoBits: [],
    prose: [],
    proseByLabel: [],
    shotPrompts: [],
    assetPrompts: [],
  }
  if (!asset || !oldName) return empty

  // 集 / 场 / 镜的自然序，让 diff 列表按剧本顺序排，而不是 Object.keys 的哈希序。
  const orderedShots: { shot: Shot; label: string }[] = []
  for (const ep of project.episodes) {
    for (const sceneId of ep.sceneIds) {
      const scene = project.scenes[sceneId]
      if (!scene) continue
      for (const shotId of scene.shotIds) {
        const shot = project.shots[shotId]
        if (shot) orderedShots.push({ shot, label: `${ep.no}集${scene.no}场 · 镜 ${shot.no}` })
      }
    }
  }

  // ── 引用侧（自动跟随）──
  const related = relatedAssetIds(assetId, project.assets)
  const mountShots = orderedShots.filter((o) =>
    o.shot.mounts.some((m) => related.has(m.assetId)),
  ).length
  const lookCount = Object.values(project.assets).filter(
    (a) => a.kind === 'look' && a.characterId === assetId,
  ).length
  const autoBits = [`挂载 ${mountShots} 镜`, '资产表 · 出场统计']
  if (lookCount > 0) autoBits.push(`${lookCount} 个角色造型名`)

  // ── 散文侧 ──
  const prose: RenameHit[] = []
  const byLabel = new Map<string, number>()
  for (const { shot, label } of orderedShots) {
    for (const { field, label: fieldLabel } of PROSE_FIELDS) {
      const text = String(shot[field] ?? '')
      const n = countOf(text, oldName)
      if (n === 0) continue
      byLabel.set(fieldLabel, (byLabel.get(fieldLabel) ?? 0) + n)
      let at = text.indexOf(oldName)
      while (at > -1) {
        prose.push({ where: `${label} · ${fieldLabel}`, ...snippet(text, at, oldName, newName) })
        at = text.indexOf(oldName, at + oldName.length)
      }
    }
  }

  // ── 提示词侧 ──
  // 镜头提示词只统计「用户看得见的那些」（已生成 / 待更新 / 生成中）。
  // pending 的镜头用户还没看到提示词，替不替换都不构成不一致，不进计数、也不标待更新。
  const shotPrompts: RenameHit[] = []
  for (const { shot, label } of orderedShots) {
    const state = promptStates[shot.id] ?? 'pending'
    if (state === 'pending') continue
    const text = shotPromptText(shot)
    const at = firstHit(text, oldName)
    if (at < 0) continue
    shotPrompts.push({ where: label, ...snippet(text, at, oldName, newName) })
  }

  // 资产自己的生图提示词（含角色素模、造型、服装、场景、道具）。
  const assetPrompts: RenameHit[] = []
  for (const a of Object.values(project.assets)) {
    const text = a.imagePrompt ?? ''
    const at = firstHit(text, oldName)
    if (at < 0) continue
    assetPrompts.push({ where: `资产提示词 · ${a.name || '（造型）'}`, ...snippet(text, at, oldName, newName) })
  }

  return {
    autoBits,
    prose,
    proseByLabel: [...byLabel.entries()].map(([label, count]) => ({ label, count })),
    shotPrompts,
    assetPrompts,
  }
}

/** 同名校验：同类目下不允许重名（本版不做合并，只拦）。 */
export function findDuplicate(
  assets: Record<string, Asset>,
  assetId: string,
  name: string,
): Asset | undefined {
  const self = assets[assetId]
  if (!self) return undefined
  return Object.values(assets).find(
    (a) => a.id !== assetId && a.kind === self.kind && !!a.name && a.name === name,
  )
}
