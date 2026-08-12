// 着装角色（look）相关的纯函数：命名与反查。
// 规则版本：v1.2（2026-08-12）。断言见 tests/rules.test.ts 的 R11。
import type { Asset, Look } from '../data/types'

/**
 * look 的展示名。Look.name 字段仍然存（AI 可以给个更顺的名），
 * lookName() 只在 name 为空时兜底为「角色 · 服装+服装」/「角色 · 默认着装」（决策 5b）。
 */
export function lookName(look: Look, assets: Record<string, Asset>): string {
  if (look.name?.trim()) return look.name
  const ch = assets[look.characterId]?.name ?? '未知角色'
  const cos = look.costumeIds.map((id) => assets[id]?.name).filter(Boolean)
  return cos.length ? `${ch} · ${cos.join('+')}` : `${ch} · 默认着装`
}

/** 某角色的所有着装角色。 */
export function looksOfCharacter(characterId: string, assets: Record<string, Asset>): Look[] {
  return Object.values(assets).filter(
    (a): a is Look => a.kind === 'look' && a.characterId === characterId,
  )
}

/** 引用了某件服装的所有着装角色（一件服装可被多个 look 使用，决策 3a）。 */
export function looksUsingCostume(costumeId: string, assets: Record<string, Asset>): Look[] {
  return Object.values(assets).filter(
    (a): a is Look => a.kind === 'look' && a.costumeIds.includes(costumeId),
  )
}
