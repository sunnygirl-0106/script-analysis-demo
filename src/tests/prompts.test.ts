// C6 逐镜提示词的数据完整性校验（数据校验，不是业务规则，独立于 rules.test.ts）。
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
    const blacklist = /运镜|推近|慢推|跟随|手持|摇摄|拉远|跳切|Rack Focus|【台词】/
    for (const [id, p] of Object.entries(PROMPTS)) {
      expect(blacklist.test(p.image), `${id}.image 命中黑名单`).toBe(false)
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
