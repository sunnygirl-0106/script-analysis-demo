import { describe, it, expect } from 'vitest'
import { parseDialogue, serializeDialogue, usedSpeakers } from '../services/dialogue'
import type { Shot } from '../data/types'

describe('parseDialogue', () => {
  it('「」内为正文，其前为说话人', () => {
    expect(parseDialogue('苏可：「你来了。」')).toEqual([
      { type: '台词', speaker: '苏可', text: '你来了。' },
    ])
  })

  it('没有引号时以第一个冒号切分（中英文冒号都认）', () => {
    expect(parseDialogue('苏可: 你来了。')).toEqual([
      { type: '台词', speaker: '苏可', text: '你来了。' },
    ])
  })

  it('旁白 / 字幕 → 旁白，说话人留空', () => {
    expect(parseDialogue('旁白：「夜色渐深。」')).toEqual([
      { type: '旁白', speaker: '', text: '夜色渐深。' },
    ])
    expect(parseDialogue('字幕：「三年后」')[0]!.type).toBe('旁白')
  })

  it('画外音 / 独白 → 台词但说话人留空，不静默归为旁白', () => {
    // 这是修过的一个 bug：这些前缀曾被一并吞成旁白并丢掉「有人在说话」这件事。
    for (const p of ['画外', '画外音', '独白', '内心独白', 'OS', 'V.O.']) {
      expect(parseDialogue(`${p}：「我早该走的。」`)).toEqual([
        { type: '台词', speaker: '', text: '我早该走的。' },
      ])
    }
  })

  it('前缀里的括注不丢，回填到正文开头', () => {
    expect(parseDialogue('苏可（碎碎念）：「又下雨了。」')).toEqual([
      { type: '台词', speaker: '苏可', text: '（碎碎念）又下雨了。' },
    ])
  })

  it('纯引号无前缀 → 台词，说话人留空', () => {
    expect(parseDialogue('「……」')).toEqual([{ type: '台词', speaker: '', text: '……' }])
  })

  it('空 / 「无」→ 零行；多行各自解析', () => {
    expect(parseDialogue('')).toEqual([])
    expect(parseDialogue('无')).toEqual([])
    expect(parseDialogue('苏可：「甲。」\n旁白：「乙。」')).toHaveLength(2)
  })
})

describe('serializeDialogue', () => {
  it('台词无说话人时不写前缀，回读仍是「台词 + 说话人留空」', () => {
    const lines = [{ type: '台词' as const, speaker: '', text: '……' }]
    const raw = serializeDialogue(lines)
    expect(raw).toBe('「……」')
    expect(parseDialogue(raw)).toEqual(lines)
  })

  it('往返：解析后再序列化，说话人与类型不丢', () => {
    const raw = '苏可：「你来了。」\n旁白：「夜色渐深。」'
    expect(serializeDialogue(parseDialogue(raw))).toBe(raw)
  })

  it('说话人与正文都空的行被丢掉', () => {
    expect(serializeDialogue([{ type: '台词', speaker: '  ', text: '  ' }])).toBe('')
  })
})

describe('usedSpeakers', () => {
  const sh = (id: string, dialogue: string) => ({ id, dialogue }) as Shot

  it('全剧去重收集台词说话人，旁白不计', () => {
    const shots = { a: sh('a', '苏可：「甲」'), b: sh('b', '苏可：「乙」\n旁白：「丙」') }
    expect(usedSpeakers(shots).sort()).toEqual(['苏可'])
  })

  it('按 shots 引用记忆化：同一份 shots 返回同一实例', () => {
    const shots = { a: sh('a', '苏可：「甲」') }
    expect(usedSpeakers(shots)).toBe(usedSpeakers(shots))
  })
})
