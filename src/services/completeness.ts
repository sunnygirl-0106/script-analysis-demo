// 资产完整性提示。纯函数。
//
// 只在下面三种情况提示，其余一律不提示。**明确不提示**（不要"补全"回去）：
//   · 没有道具 → 正常，大量镜头本来就没道具
//   · 没有角色 → 正常，空镜 / 物件特写
// 「一个镜头没挂满，不等于它有问题」——这是这条规则存在的全部理由。
import type { Asset, Look, MountableKind, Shot } from '../data/types'
import { looksOfCharacter } from './looks'
import { parsePromptSections } from './promptFormat'
import { compileTerms, type Matcher } from './mentions'

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

type IssueLevel = 'action' | 'hint'

interface MountIssue {
  level: IssueLevel
  text: string
  /** level==='action' 时携带：点一下就能挂上的那个资产（角色会挂它的 look） */
  assetId?: string
  kind?: MountableKind
}

/**
 * 从镜头文本里挑出「被点名但没挂」的资产。
 *
 * 口径**刻意窄于**剧本原文高亮：只认角色 / 道具的**编目名**，不认别名。
 * 别名（「手机」之于「智能手机」）在正文里指代宽松，拿来判「漏挂载」会误报，
 * 而这条提示是要用户去点的，宁可漏报不误报。
 * 词表按 assets 引用记忆化，不再每个镜头行各建一次正则。
 */
const nameableCache = new WeakMap<object, Matcher<Asset> | null>()

function nameableMatcher(assets: Record<string, Asset>): Matcher<Asset> | null {
  const cached = nameableCache.get(assets)
  if (cached !== undefined) return cached
  const m = compileTerms<Asset>(
    Object.values(assets)
      .filter((a) => a.kind === 'character' || a.kind === 'prop')
      .map((a) => [a.name, a] as const),
  )
  nameableCache.set(assets, m)
  return m
}

function mentionedAssetIds(text: string, assets: Record<string, Asset>): Set<string> {
  const m = nameableMatcher(assets)
  if (!m) return new Set()
  const out = new Set<string>()
  for (const hit of text.match(m.re) ?? []) {
    const a = m.byTerm.get(hit)
    if (a) out.add(a.id)
  }
  return out
}

/** 只在三种情况提示，其余一律返回空。 */
export function mountIssues(shot: Shot, assets: Record<string, Asset>): MountIssue[] {
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
  const mentioned = mentionedAssetIds(text, assets)
  for (const id of mentioned) {
    const asset = assets[id]!
    if (asset.kind === 'prop') {
      if (mountedPropIds.has(id)) continue
      issues.push({ level: 'action', text: `＋ 添加「${asset.name}」`, assetId: id, kind: 'prop' })
    } else {
      // 角色：挂了它的任一 look 或挂了它本身，都算已挂。
      if (coveredCharacterIds.has(id)) continue
      // 一键挂上时挂它的 look（若有；多套取出场最多的那套，此处按 id 稳定取首个作 demo 近似），
      // 没有任何 look 才退回挂 character 兜底。
      const looks = looksOfCharacter(id, assets)
      if (looks.length > 0) {
        issues.push({ level: 'action', text: `＋ 添加「${asset.name}」`, assetId: looks[0]!.id, kind: 'look' })
      } else {
        issues.push({ level: 'action', text: `＋ 添加「${asset.name}」`, assetId: id, kind: 'character' })
      }
    }
  }

  // 规则 2：挂了 character（素模）而不是 look → hint「未指定着装」。
  // 这是 MountableKind 保留 'character' 兜底的唯一理由。
  for (const m of shot.mounts) {
    if (m.kind !== 'character') continue
    const char = assets[m.assetId]
    if (!char) continue
    issues.push({ level: 'hint', text: `${char.name}还没有选择造型` })
  }

  // 规则 3：mounts 里没有任何 location → hint「未指定场景」。
  if (!shot.mounts.some((m) => m.kind === 'location')) {
    issues.push({ level: 'hint', text: '请选择场景' })
  }

  return issues
}
