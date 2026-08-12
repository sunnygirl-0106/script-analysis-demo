// R9 资产完整性提示。纯函数。
// 规则版本：v1.2（2026-08-12）。断言见 tests/rules.test.ts 的 R9。
//
// 只在下面三种情况提示，其余一律不提示。**明确不提示**（不要"补全"回去）：
//   · 没有道具 → 正常，大量镜头本来就没道具
//   · 没有角色 → 正常，空镜 / 物件特写
// 「一个镜头没挂满，不等于它有问题」——这是这条规则存在的全部理由。
import type { Asset, Look, MountableKind, Shot } from '../data/types'
import { looksOfCharacter } from './looks'
import { parsePromptSections } from './promptFormat'

/**
 * 规则 1 只在「描述画面里有什么」的段里找人名。
 *
 * 提示词扩写成完全版之后，一条 image 有八段、一条 video 有六段，其中好几段提到人名
 * 恰恰是在说「这个人不要出现」——【禁止】里的负向提示词、【节奏】里的剪辑说明。
 * 所以这里用白名单而不是黑名单——将来新增段标签时，默认不参与判定，宁可漏报不误报。
 */
const SCANNED_TAGS = ['主体', '次主体', '服装', '环境', '表演']
function visibleText(text: string): string {
  return parsePromptSections(text)
    // tag 为空的是视频提示词开头的时间码段，描述的正是画面里发生了什么，要扫。
    .filter((sec) => !sec.tag || SCANNED_TAGS.some((t) => sec.tag.startsWith(t)))
    .map((sec) => sec.body)
    .join(' ')
}

export type IssueLevel = 'action' | 'hint'

export interface MountIssue {
  level: IssueLevel
  text: string
  /** level==='action' 时携带：点一下就能挂上的那个资产（角色会挂它的 look） */
  assetId?: string
  kind?: MountableKind
}

/**
 * 从镜头文本里挑出「被点名但没挂」的资产名。
 * 匹配方式与 ScriptPanel 的高亮一致：只取 name 长度 ≥ 2 的资产，长名优先，
 * 用正则 split 后收集命中集（避免「苏可」吃掉「苏可可」）。
 */
function mentionedAssetIds(text: string, assets: Asset[]): Set<string> {
  const named = assets
    .filter((a) => a.name.length >= 2)
    .sort((a, b) => b.name.length - a.name.length)
  if (named.length === 0) return new Set()
  const escaped = named.map((a) => a.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`(${escaped.join('|')})`, 'g')
  const hitNames = new Set(text.match(re) ?? [])
  return new Set(named.filter((a) => hitNames.has(a.name)).map((a) => a.id))
}

/** 只在三种情况提示，其余一律返回空。 */
export function mountIssues(shot: Shot, assets: Record<string, Asset>): MountIssue[] {
  const list = Object.values(assets)
  const issues: MountIssue[] = []

  // 已被本镜覆盖的角色 = 直接挂的 character（兜底）∪ 已挂 look 的 characterId。
  const coveredCharacterIds = new Set<string>()
  for (const m of shot.mounts) {
    if (m.kind === 'character') coveredCharacterIds.add(m.assetId)
    if (m.kind === 'look') {
      const look = assets[m.assetId] as Look | undefined
      if (look) coveredCharacterIds.add(look.characterId)
    }
  }
  const mountedPropIds = new Set(shot.mounts.filter((m) => m.kind === 'prop').map((m) => m.assetId))

  // 规则 1：镜头文本里明确提到了某角色 / 道具，但没挂 → 可点击挂上。
  // 只看角色 / 道具：场景是结构性的（一场一景），它的缺失由规则 3 单独判定，不靠文本点名。
  const text = [
    shot.title,
    visibleText(shot.imagePrompt),
    visibleText(shot.videoPrompt),
    shot.sourceQuote,
  ].join(' ')
  const nameable = list.filter((a) => a.kind === 'character' || a.kind === 'prop')
  const mentioned = mentionedAssetIds(text, nameable)
  for (const id of mentioned) {
    const asset = assets[id]!
    if (asset.kind === 'prop') {
      if (mountedPropIds.has(id)) continue
      issues.push({ level: 'action', text: `未挂载：${asset.name}`, assetId: id, kind: 'prop' })
    } else {
      // 角色：挂了它的任一 look 或挂了它本身，都算已挂。
      if (coveredCharacterIds.has(id)) continue
      // 一键挂上时挂它的 look（若有；多套取出场最多的那套，此处按 id 稳定取首个作 demo 近似），
      // 没有任何 look 才退回挂 character 兜底。
      const looks = looksOfCharacter(id, assets)
      if (looks.length > 0) {
        issues.push({ level: 'action', text: `未挂载：${asset.name}`, assetId: looks[0]!.id, kind: 'look' })
      } else {
        issues.push({ level: 'action', text: `未挂载：${asset.name}`, assetId: id, kind: 'character' })
      }
    }
  }

  // 规则 2：挂了 character（素模）而不是 look → hint「未指定着装」。
  // 这是 MountableKind 保留 'character' 兜底的唯一理由。
  for (const m of shot.mounts) {
    if (m.kind !== 'character') continue
    const char = assets[m.assetId]
    if (!char) continue
    issues.push({ level: 'hint', text: `${char.name}未指定着装` })
  }

  // 规则 3：mounts 里没有任何 location → hint「未指定场景」。
  if (!shot.mounts.some((m) => m.kind === 'location')) {
    issues.push({ level: 'hint', text: '未指定场景' })
  }

  return issues
}
