// 资产提示词的数据完整性校验，来源《最后的尊严 · 资产提示词完全版》。
//
// 资产是**先生成、再被 46 个镜头反复引用**的底座：苏可的定妆图不稳，46 镜全崩。
// 所以这里的断言比镜头那边更严。历史教训见 prompts.test.ts 顶部注释——
// **不要为了让测试通过去放宽阈值。**
import { describe, it, expect } from 'vitest'
import { seedProject } from '../data/seed'
import { ep2Assets } from '../data/seedEpisode2'
import type { Asset, Costume } from '../data/types'

// 第 2 集里的「苏可」是等待归一化复用的临时条目，提示词是一句占位说明，不参与校验。
const isPlaceholder = (a: Asset) => a.imagePrompt.startsWith('（')
const ALL: Asset[] = [...Object.values(seedProject.assets), ...ep2Assets].filter((a) => !isPlaceholder(a))

function tagsOf(text: string): string[] {
  return [...text.matchAll(/【([^】]+)】/g)].map((m) => m[1]!)
}

/** 四类资产各自的必写段（见《资产提示词完全版》§0.1）。 */
const REQUIRED: Record<Asset['kind'], string[]> = {
  character: ['生成规格', '体型', '面部', '发型', '肤色气质', '手部', '基础着装', '三视图要求', '光线', '质感', '禁止'],
  costume: ['生成规格', '款式版型', '颜色材质', '工艺细节', '配件', '状态', '光线', '质感', '禁止'],
  location: ['生成规格', '空间结构', '陈设', '前景', '中景', '背景', '材质色彩', '光线', '色调质感', '禁止'],
  prop: ['生成规格', '形态', '材质颜色', '细节', '状态', '辅视图', '光线', '质感', '禁止'],
}

describe('资产提示词完整性', () => {
  it('19 个资产全部就位（角色 4 · 服装 4 · 场景 4 · 道具 7）', () => {
    const byKind = (k: Asset['kind']) => ALL.filter((a) => a.kind === k).length
    expect(byKind('character')).toBe(4)
    expect(byKind('costume')).toBe(4)
    expect(byKind('location')).toBe(4)
    expect(byKind('prop')).toBe(7)
    expect(ALL.length).toBe(19)
  })

  it('每个角色都至少有一套自己的服装 —— 挂载到镜头上的必须是穿好衣服的定妆照', () => {
    const costumes = ALL.filter((a): a is Costume => a.kind === 'costume')
    for (const ch of ALL.filter((a) => a.kind === 'character')) {
      const own = costumes.filter((c) => c.characterId === ch.id)
      expect(own.length, `角色「${ch.name}」没有任何服装资产`).toBeGreaterThanOrEqual(1)
    }
  })

  it('四类资产的段式各自齐全', () => {
    for (const a of ALL) {
      const tags = tagsOf(a.imagePrompt)
      for (const tag of REQUIRED[a.kind]) {
        expect(tags, `${a.kind}「${a.name}」缺【${tag}】`).toContain(tag)
      }
    }
  })

  it('长度下限：资产提示词不允许被「精简」回一句话', () => {
    // 当前实测最短 792 字、中位 1057 字，阈值留了余量。
    // 触发这条时先问「是谁把字删了」，不要调小数字。
    for (const a of ALL) {
      expect(a.imagePrompt.length, `「${a.name}」只有 ${a.imagePrompt.length} 字，疑似被精简`).toBeGreaterThanOrEqual(700)
    }
  })

  it('小传下限：description 是卡片上唯一一眼能看到的文字，不能只有一句话', () => {
    // 当前实测最短 142 字。资产卡片大字显示的就是它，imagePrompt 折叠在下面。
    for (const a of ALL) {
      expect(a.description.length, `「${a.name}」的小传只有 ${a.description.length} 字`).toBeGreaterThanOrEqual(100)
    }
  })

  it('角色素模里不得混进戏服（素模 + 服装分开生成再融合）', () => {
    // 只扫【基础着装】段：戏服名出现在【禁止】里是对的，出现在着装描述里就是把两半揉一起了。
    const wardrobe = /卫衣|开衫|冲锋衣|工装|鸭舌帽|保温|扫描枪|工牌|布鞋|外套/
    for (const a of ALL.filter((x) => x.kind === 'character')) {
      const m = a.imagePrompt.match(/【基础着装】([\s\S]*?)(?=\n【|$)/)
      expect(m, `角色「${a.name}」没有【基础着装】段`).toBeTruthy()
      expect(wardrobe.test(m![1]!), `角色「${a.name}」的【基础着装】里混进了戏服`).toBe(false)
    }
  })

  it('服装与场景是「空图」：不得出现人物', () => {
    for (const a of ALL.filter((x) => x.kind === 'costume' || x.kind === 'location')) {
      expect(a.imagePrompt, `${a.kind}「${a.name}」没写明无人物`).toMatch(/无人物/)
    }
  })

  it('每条都带【禁止】，且禁掉画面内字幕与水印', () => {
    for (const a of ALL) {
      expect(a.imagePrompt, `「${a.name}」`).toContain('【禁止】')
      expect(a.imagePrompt, `「${a.name}」的【禁止】没写字幕/水印`).toMatch(/字幕/)
    }
  })
})
