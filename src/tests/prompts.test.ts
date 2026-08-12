// C6 逐镜提示词的数据完整性校验（数据校验，不是业务规则，独立于 rules.test.ts）。
//
// 这个文件的存在理由：提示词是《最后的尊严 · 逐镜提示词完全版》里一个字一个字写出来的，
// 单条 400–840 字。历史上它被「顺手精简」过一次，46 镜的视频提示词从六段式塌成两三句
// （总字数 26,995 → 3,696），而且没有任何东西报警。下面的段落齐全性与长度下限断言就是
// 为了让下一次「精简」在 CI 里直接红掉。**不要为了让测试通过去放宽这里的阈值。**
import { describe, it, expect } from 'vitest'
import { seedProject } from '../data/seed'
import { shotPresets } from '../data/shotPresets'
import { ep2ShotStore } from '../data/seedEpisode2'
import { PROMPTS } from '../data/prompts'

// 全部 shot id 与其时长（seed 25 + presets 16 + ep2 5 = 46）。
const durOf: Record<string, number> = {}
for (const sh of Object.values(seedProject.shots)) durOf[sh.id] = sh.duration
for (const byDensity of Object.values(shotPresets)) {
  for (const arr of Object.values(byDensity)) {
    for (const sh of arr!) durOf[sh.id] = sh.duration
  }
}
for (const sh of Object.values(ep2ShotStore)) durOf[sh.id] = sh.duration

const ALL_IDS = new Set(Object.keys(durOf))

/** 单条提示词里出现的段标签，如 ['镜头规格','主体','服装',…]。 */
function tagsOf(text: string): string[] {
  return [...text.matchAll(/【([^】]+)】/g)].map((m) => m[1]!)
}

describe('PROMPTS 数据完整性', () => {
  it('覆盖完整：键集合 === 全部 46 个 shot id，无缺无多', () => {
    expect(ALL_IDS.size).toBe(46)
    expect(new Set(Object.keys(PROMPTS))).toEqual(ALL_IDS)
  })

  it('每条 image / video 都含【禁止】', () => {
    for (const [id, p] of Object.entries(PROMPTS)) {
      expect(p.image, `${id}.image`).toContain('【禁止】')
      expect(p.video, `${id}.video`).toContain('【禁止】')
    }
  })

  it('画面提示词不含运镜与台词', () => {
    // 画面是静止的：写「推近」「跟随」等于用 token 描述模型画不出来的东西。
    // 这条曾经抓到过两处真实泄漏（s3_sh12「饱和度在推近过程中」、s1_l2「焦点始终跟随面部」），
    // 正确做法是改提示词，不是往黑名单里开口子。
    const blacklist = /运镜|推近|慢推|跟随|手持|摇摄|拉远|跳切|Rack Focus|【台词】/
    for (const [id, p] of Object.entries(PROMPTS)) {
      expect(blacklist.test(p.image), `${id}.image 命中黑名单`).toBe(false)
    }
  })

  it('画面提示词七段式齐全（完全版 §0.2）', () => {
    // 【次主体】允许缺席（有的镜确实只有一个主体）；其余六段每镜必写。
    // 【主体】允许带后缀，如「主体（前段）」「主体（画面左）」。
    const required = ['镜头规格', '服装', '环境', '光线', '色调质感', '禁止']
    for (const [id, p] of Object.entries(PROMPTS)) {
      const tags = tagsOf(p.image)
      for (const tag of required) {
        expect(tags, `${id}.image 缺【${tag}】`).toContain(tag)
      }
      const hasSubject = tags.some((t) => t.startsWith('主体'))
      expect(hasSubject, `${id}.image 缺【主体】`).toBe(true)
    }
  })

  it('视频提示词六段式齐全（完全版 §0.3）', () => {
    // 这条就是当年那次「精简」的正面拦截点：被砍掉的正是【表演】【节奏】。
    const required = ['运镜', '表演', '台词', '声音', '节奏', '禁止']
    for (const [id, p] of Object.entries(PROMPTS)) {
      const tags = tagsOf(p.video)
      for (const tag of required) {
        expect(tags, `${id}.video 缺【${tag}】`).toContain(tag)
      }
    }
  })

  it('长度下限：单条提示词不允许被「精简」回一句话', () => {
    // 当前实测 image 最短 402 字、video 最短 248 字，阈值留了余量。
    // 触发这条时先问「是谁把字删了」，而不是把数字调小。
    for (const [id, p] of Object.entries(PROMPTS)) {
      expect(p.image.length, `${id}.image 只有 ${p.image.length} 字，疑似被精简`).toBeGreaterThanOrEqual(350)
      expect(p.video.length, `${id}.video 只有 ${p.video.length} 字，疑似被精简`).toBeGreaterThanOrEqual(200)
    }
  })

  it('视频时间码自洽：起于 0、逐段首尾相接无缺口、末值 === 该镜 duration', () => {
    const seg = /\{(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)s\}/g
    for (const [id, p] of Object.entries(PROMPTS)) {
      const codes = [...p.video.matchAll(seg)].map((m) => [Number(m[1]), Number(m[2])] as const)
      expect(codes.length, `${id} 无时间码`).toBeGreaterThan(0)
      expect(codes[0]![0], `${id} 起始非 0`).toBe(0)
      for (let i = 1; i < codes.length; i++) {
        expect(codes[i]![0], `${id} 第 ${i} 段有缺口`).toBe(codes[i - 1]![1])
      }
      expect(codes[codes.length - 1]![1], `${id} 末值≠duration`).toBe(durOf[id])
    }
  })
})
