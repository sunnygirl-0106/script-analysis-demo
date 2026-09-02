// 候选资产的抽取与入库。纯函数。
//
// v3 的三层状态在这里落地：
//   项目资产库      = project.assets（只增不减，删除出口只有资产库本身）
//   当前剧本引用    = buildUsageIndex(project) 的 shotCount > 0（派生，不存）
//   待确认新候选    = CandidateAsset[]（本模块）
import type { Asset, CandidateAsset, Look, Project } from '../data/types'
import { assetKey } from './incremental'

const normalize = (s: string) => s.replace(/\s+/g, '').toLowerCase()

/** 本次范围内 AI 抽到的一条资产（阶段②还没有集/场/镜，出现信息用原文口径）。 */
export interface ScannedAsset {
  kind: CandidateAsset['kind']
  name: string
  imagePrompt?: string
  aliases?: string[]
  costumeIds?: string[]
  characterId?: string
  firstParaNo?: number
  occCount?: number
}

/** 一条资产/候选的全部判重 key：名称 + 所有别名（都归一化，都带 kind 前缀）。
 *  别名参与判重是「使用已有资产」能真正落地的地基：把候选名写进目标别名后，
 *  下次同名再来就命中别名、不再当新资产问一遍（§4.3）。 */
function keysOf(x: { kind: CandidateAsset['kind']; name: string; aliases?: string[] }): string[] {
  return [assetKey(x), ...(x.aliases ?? []).map((al) => assetKey({ kind: x.kind, name: al }))]
}

/** 从一批「本次范围内 AI 抽到的资产」里，滤掉库里已有的同名同类项（含别名），也在批内去重。
 *  判重复用 incremental.assetKey，全系统只此一处判重逻辑。 */
export function extractCandidates(project: Project, scanned: ScannedAsset[]): CandidateAsset[] {
  const existing = new Set(Object.values(project.assets).flatMap(keysOf))
  const seen = new Set<string>()
  const out: CandidateAsset[] = []
  for (const item of scanned) {
    const itemKeys = keysOf(item)
    if (itemKeys.some((k) => existing.has(k) || seen.has(k))) continue
    itemKeys.forEach((k) => seen.add(k))
    out.push({
      tempId: `cand_${item.kind}_${normalize(item.name)}`,
      kind: item.kind,
      name: item.name,
      imagePrompt: item.imagePrompt ?? '',
      aliases: item.aliases,
      costumeIds: item.costumeIds,
      characterId: item.characterId,
      firstParaNo: item.firstParaNo,
      occCount: item.occCount,
      decision: 'new',
    })
  }
  return out
}

/** 同名拦截：候选改名后与库内既有同类资产重名 → 不允许作为新资产入库（v3 R4，倩姐口径）。 */
export function nameConflict(project: Project, cand: CandidateAsset): Asset | undefined {
  const key = assetKey(cand)
  return Object.values(project.assets).find((a) => assetKey(a) === key)
}

function buildAsset(cand: CandidateAsset, id: string, resolve: (tempId: string) => string): Asset {
  const base = {
    id,
    name: cand.name,
    aliases: cand.aliases,
    imagePrompt: cand.imagePrompt,
    promptRevision: 0,
  }
  switch (cand.kind) {
    case 'character':
      return { ...base, kind: 'character', role: 'support' }
    case 'costume':
      return { ...base, kind: 'costume' }
    case 'location':
      return { ...base, kind: 'location', timeOfDay: '' }
    case 'prop':
      return { ...base, kind: 'prop' }
    case 'look':
      return {
        ...base,
        kind: 'look',
        characterId: cand.characterId ? resolve(cand.characterId) : '',
        costumeIds: (cand.costumeIds ?? []).map(resolve),
      }
  }
}

/** 结算一批候选。
 *  new  → 新建资产入库，promptRevision = 0，deliveredRevision = undefined
 *  link → 不新建，返回 links 供调用方建立引用（本期只用于回执文案）
 *  skip → 什么都不做
 *  已有资产一律不覆盖、不删除。命中库内同名（改名后撞车）的 new 自动降级为 skip。 */
export function commitCandidates(
  project: Project,
  cands: CandidateAsset[],
): {
  project: Project
  added: string[]
  linked: Array<{ tempId: string; targetId: string }>
  skipped: string[]
} {
  const added: string[] = []
  const linked: Array<{ tempId: string; targetId: string }> = []
  const skipped: string[] = []

  // ① 同名拦截：命中库内既有同类资产的 new 候选降级为 skip（不抛异常，由调用方提示）。
  const effective = cands.map((c) => {
    if (c.decision === 'new' && nameConflict(project, c)) {
      skipped.push(c.tempId)
      return { ...c, decision: 'skip' as const }
    }
    return c
  })

  // ② 先给所有确定要入库的 new 分配最终 id，便于角色 → 造型的交叉引用解析。
  const finalId = new Map<string, string>()
  for (const c of effective) {
    if (c.decision === 'new') finalId.set(c.tempId, `as_${c.tempId}`)
  }
  const resolve = (tempId: string) => finalId.get(tempId) ?? tempId

  // ③ 结算。newAssets 单独攒，最后一次性并入，保证既有 assets 条目引用相等。
  // 「使用已有资产」要真正落地：把候选名（及其别名）写进目标资产的 aliases，
  // 否则去重是 kind+名称精确匹配，下次同名会被再当新资产问一遍（§4.3）。
  const aliasAdds = new Map<string, Set<string>>()
  const newAssets: Record<string, Asset> = {}
  for (const c of effective) {
    if (c.decision === 'link') {
      if (c.linkTargetId) {
        linked.push({ tempId: c.tempId, targetId: c.linkTargetId })
        // 目标存在才写别名（写不进不存在的资产）。
        if (project.assets[c.linkTargetId]) {
          const set = aliasAdds.get(c.linkTargetId) ?? new Set<string>()
          for (const al of [c.name, ...(c.aliases ?? [])]) set.add(al)
          aliasAdds.set(c.linkTargetId, set)
        }
      }
      continue
    }
    if (c.decision === 'skip') {
      if (!skipped.includes(c.tempId)) skipped.push(c.tempId)
      continue
    }
    // new
    const id = finalId.get(c.tempId)!
    newAssets[id] = buildAsset(c, id, resolve)
    added.push(id)
    // 角色候选带 costumeIds → 一并生成对应的着装角色（look），characterId 指向刚入库的角色。
    if (c.kind === 'character' && c.costumeIds?.length) {
      const lookId = `lk_${id}`
      const look: Look = {
        id: lookId, kind: 'look', name: '', characterId: id,
        costumeIds: c.costumeIds.map(resolve), imagePrompt: '', promptRevision: 0,
      }
      newAssets[lookId] = look
      added.push(lookId)
    }
  }

  // 把 link 的别名并进目标资产（去重、只增）。
  const withAliases = { ...project.assets, ...newAssets }
  for (const [targetId, adds] of aliasAdds) {
    const target = withAliases[targetId]
    if (!target) continue
    const existing = new Set(target.aliases ?? [])
    const merged = [...(target.aliases ?? [])]
    for (const al of adds) {
      if (al && al !== target.name && !existing.has(al)) { merged.push(al); existing.add(al) }
    }
    withAliases[targetId] = { ...target, aliases: merged }
  }

  return {
    project: { ...project, assets: withAliases },
    added,
    linked,
    skipped,
  }
}
