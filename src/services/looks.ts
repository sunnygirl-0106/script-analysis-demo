// 着装角色（Look）的关系查询与出场统计。纯函数。
//
// Look = 角色 × 服装，是 AI 分析给出的确定关系，也是分镜里唯一的人物参考。
// 不要通过遍历同镜里的 character + costume 临时猜组合 —— Look 已经是唯一来源。
import type { Asset, Character, Costume, Look, Shot } from '../data/types'
import { summarizeAppearances, type AppearanceSummary } from './appearance'

/** 全部着装角色。 */
export function allLooks(assets: Record<string, Asset>): Look[] {
  return Object.values(assets).filter((a): a is Look => a.kind === 'look')
}

/** 某个角色的全部着装角色（一个角色可以有多套 Look）。 */
export function looksOfCharacter(characterId: string, assets: Record<string, Asset>): Look[] {
  return allLooks(assets).filter((l) => l.characterId === characterId)
}

/** 引用了某件服装的全部着装角色（一件服装可被 0 / 1 / 多个 Look 引用）。 */
export function looksUsingCostume(costumeId: string, assets: Record<string, Asset>): Look[] {
  return allLooks(assets).filter((l) => l.costumeId === costumeId)
}

/** 本镜挂载的着装角色（按 mounts 里的 look 反查，保持挂载顺序）。 */
export function lookOfShot(shot: Shot, assets: Record<string, Asset>): Look[] {
  return shot.mounts
    .filter((m) => m.kind === 'look')
    .map((m) => assets[m.assetId])
    .filter((a): a is Look => a?.kind === 'look')
}

/** Look 引用的角色（可能缺失，表示关系数据不完整）。 */
export function lookCharacter(look: Look, assets: Record<string, Asset>): Character | undefined {
  const a = assets[look.characterId]
  return a?.kind === 'character' ? a : undefined
}

/** Look 引用的服装。 */
export function lookCostume(look: Look, assets: Record<string, Asset>): Costume | undefined {
  const a = assets[look.costumeId]
  return a?.kind === 'costume' ? a : undefined
}

/** 校验：Look.characterId 指向角色、Look.costumeId 指向服装。 */
export function isValidLook(look: Look, assets: Record<string, Asset>): boolean {
  return !!lookCharacter(look, assets) && !!lookCostume(look, assets)
}

/** 着装角色的出场汇总（集 / 场），镜数由 store.countShotsOf 反查。 */
export function lookAppearances(look: Look): AppearanceSummary {
  return summarizeAppearances(look.appearances)
}
