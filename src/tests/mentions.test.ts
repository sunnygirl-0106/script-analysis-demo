import { describe, it, expect } from 'vitest'
import { compileTerms, assetMatcher, splitMentions } from '../services/mentions'
import type { Asset } from '../data/types'

const mk = (id: string, name: string, aliases?: string[]): Asset =>
  ({ id, kind: 'prop', name, aliases, imagePrompt: '', promptRevision: 0 } as unknown as Asset)

describe('matcher', () => {
  it('长词优先：外卖员 不被切成 外卖+员', () => {
    const m = compileTerms([['外卖', 1], ['外卖员', 2]] as const)!
    expect('一个外卖员来了'.split(m.re).filter(Boolean)).toEqual(['一个', '外卖员', '来了'])
  })
  it('苏可 不吃掉 苏可可', () => {
    const m = compileTerms([['苏可', 1], ['苏可可', 2]] as const)!
    expect('苏可可和苏可'.split(m.re).filter(Boolean)).toEqual(['苏可可', '和', '苏可'])
  })
  it('长度 <2 的词不入表', () => {
    expect(compileTerms([['x', 1]] as const)).toBeNull()
  })
  it('正则元字符被转义', () => {
    const m = compileTerms([['a.b', 1]] as const)!
    expect('a.b axb'.split(m.re).filter(Boolean)).toEqual(['a.b', ' axb'])
  })
  it('assetMatcher 按引用记忆化：同一份 assets 返回同一实例', () => {
    const assets = { p1: mk('p1', '智能手机', ['手机']) }
    expect(assetMatcher(assets)).toBe(assetMatcher(assets))
  })
  it('别名参与匹配，命中回到编目资产 id', () => {
    const assets = { p1: mk('p1', '智能手机', ['手机']) }
    expect(splitMentions('他掏出手机', assets)).toEqual([
      { text: '他掏出' }, { text: '手机', assetId: 'p1' },
    ])
  })
  it('look 不进词表', () => {
    const look = { id: 'lk', kind: 'look', name: '苏可 · 卫衣', characterId: 'c', costumeIds: [] } as unknown as Asset
    expect(assetMatcher({ lk: look })).toBeNull()
  })
})
