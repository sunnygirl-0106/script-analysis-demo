// 资产提示词的数据完整性校验，来源《最后的尊严 · 资产提示词完全版》。
//
// 资产是**先生成、再被镜头反复引用**的底座：苏可的定妆图不稳，全片崩。
// v1.2（资产页改造）：服装取消单一角色归属，新增着装角色（look）实体。
//   · 四类基础资产（角色/服装/场景/道具）保留严格的段式与长度校验。
//   · 着装角色只校验：提示词非空、关系 id 有效、名称与出场存在。
// 历史教训见 prompts.test.ts 顶部注释——**不要为了让测试通过去放宽阈值。**
import { describe, it, expect } from 'vitest'
import { seedProject } from '../data/seed'
import { ep2Assets } from '../data/seedEpisode2'
import type { Asset, BaseAssetKind, Look } from '../data/types'

// 第 2 集里的「苏可」是等待归一化复用的临时条目，提示词是一句占位说明，不参与校验。
const isPlaceholder = (a: { imagePrompt: string }) => a.imagePrompt.startsWith('（')
const ALL: Asset[] = [
  ...Object.values(seedProject.assets),
  ...ep2Assets.map((a) => ({ ...a, revision: 1 }) as Asset),
].filter((a) => !isPlaceholder(a))

const byId = new Map(ALL.map((a) => [a.id, a]))
const BASE: Asset[] = ALL.filter((a) => a.kind !== 'look')
const LOOKS: Look[] = ALL.filter((a): a is Look => a.kind === 'look')

function tagsOf(text: string): string[] {
  return [...text.matchAll(/【([^】]+)】/g)].map((m) => m[1]!)
}

/** 四类基础资产各自的必写段（见《资产提示词完全版》§0.1）。 */
const REQUIRED: Record<BaseAssetKind, string[]> = {
  character: ['生成规格', '体型', '面部', '发型', '肤色气质', '手部', '基础着装', '三视图要求', '光线', '质感', '禁止'],
  costume: ['生成规格', '款式版型', '颜色材质', '工艺细节', '配件', '状态', '光线', '质感', '禁止'],
  location: ['生成规格', '空间结构', '陈设', '前景', '中景', '背景', '材质色彩', '光线', '色调质感', '禁止'],
  prop: ['生成规格', '形态', '材质颜色', '细节', '状态', '辅视图', '光线', '质感', '禁止'],
}

describe('资产完整性', () => {
  it('资产数量：角色 4 · 服装 4 · 场景 4 · 道具 7 · 着装角色 4', () => {
    const byKind = (k: Asset['kind']) => ALL.filter((a) => a.kind === k).length
    expect(byKind('character')).toBe(4)
    expect(byKind('costume')).toBe(4)
    expect(byKind('location')).toBe(4)
    expect(byKind('prop')).toBe(7)
    expect(byKind('look')).toBe(4)
    expect(ALL.length).toBe(23)
  })

  it('四类基础资产：名称、出场、提示词非空', () => {
    for (const a of BASE) {
      expect(a.name.length, `${a.kind} 资产缺名称`).toBeGreaterThan(0)
      expect(a.appearances.length, `「${a.name}」没有出场记录`).toBeGreaterThanOrEqual(1)
      expect(a.imagePrompt.length, `「${a.name}」提示词为空`).toBeGreaterThan(0)
    }
  })

  it('四类基础资产的段式各自齐全', () => {
    for (const a of BASE) {
      const tags = tagsOf(a.imagePrompt)
      for (const tag of REQUIRED[a.kind as BaseAssetKind]) {
        expect(tags, `${a.kind}「${a.name}」缺【${tag}】`).toContain(tag)
      }
    }
  })

  it('长度下限：基础资产提示词不允许被「精简」回一句话', () => {
    for (const a of BASE) {
      expect(a.imagePrompt.length, `「${a.name}」只有 ${a.imagePrompt.length} 字，疑似被精简`).toBeGreaterThanOrEqual(700)
    }
  })

  it('服装与场景是「空图」：不得出现人物', () => {
    for (const a of BASE.filter((x) => x.kind === 'costume' || x.kind === 'location')) {
      expect(a.imagePrompt, `${a.kind}「${a.name}」没写明无人物`).toMatch(/无人物/)
    }
  })

  it('每条基础资产都带【禁止】，且禁掉画面内字幕', () => {
    for (const a of BASE) {
      expect(a.imagePrompt, `「${a.name}」`).toContain('【禁止】')
      expect(a.imagePrompt, `「${a.name}」的【禁止】没写字幕`).toMatch(/字幕/)
    }
  })

  it('角色素模里不得混进戏服（素模 + 服装分开生成再融合）', () => {
    const wardrobe = /卫衣|开衫|冲锋衣|工装|鸭舌帽|保温|扫描枪|工牌|布鞋|外套/
    for (const a of ALL.filter((x) => x.kind === 'character')) {
      const m = a.imagePrompt.match(/【基础着装】([\s\S]*?)(?=\n【|$)/)
      expect(m, `角色「${a.name}」没有【基础着装】段`).toBeTruthy()
      expect(wardrobe.test(m![1]!), `角色「${a.name}」的【基础着装】里混进了戏服`).toBe(false)
    }
  })

  it('着装角色：提示词非空、名称与出场存在、角色/服装关系 id 有效', () => {
    expect(LOOKS.length).toBeGreaterThan(0)
    for (const lk of LOOKS) {
      expect(lk.name.length, 'look 缺名称').toBeGreaterThan(0)
      expect(lk.imagePrompt.length, `「${lk.name}」提示词为空`).toBeGreaterThan(0)
      expect(lk.appearances.length, `「${lk.name}」没有出场记录`).toBeGreaterThanOrEqual(1)
      const ch = byId.get(lk.characterId)
      const cos = byId.get(lk.costumeId)
      expect(ch?.kind, `「${lk.name}」的 characterId 未指向角色`).toBe('character')
      expect(cos?.kind, `「${lk.name}」的 costumeId 未指向服装`).toBe('costume')
    }
  })
})
