// 主流程的视图链。
//
// 为什么这一条值得留：analysisView 只有 7 个合法值，在类型检查眼里它们完全等价。
// 把「提取跑完」误写成落到 episodes 而不是 assetConfirm，tsc 不会响、build 照过，
// 要点到那一步才发现页面串了。这里把整条链走一遍，逐屏核对落在哪。
import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '../store/useStore'
import { STEP_OF_VIEW } from '../data/types'

const view = () => useStore.getState().analysisView
const step = () => STEP_OF_VIEW[view()]

describe('主流程的视图链', () => {
  beforeEach(() => {
    useStore.getState().replayDemo()
  })

  it('进站是空态，步骤条停在 ①', () => {
    expect(view()).toBe('empty')
    expect(step()).toBe(1)
  })

  it('开始整理 → organizing（动效，仍归 ①）→ 跑完落 episodes', () => {
    useStore.getState().beginOrganize()
    expect(view()).toBe('organizing')
    expect(step()).toBe(1)

    useStore.getState().finishOrganize()
    expect(view()).toBe('episodes')
    expect(step()).toBe(1)
  })

  it('确认集数 → extracting **立刻归 ②**（动效属于目标步骤，不属于来源步骤）', () => {
    useStore.getState().beginOrganize()
    useStore.getState().finishOrganize()
    useStore.getState().startExtract()
    expect(view()).toBe('extracting')
    expect(step()).toBe(2)
  })

  it('提取跑完 → assetConfirm', () => {
    useStore.getState().beginOrganize()
    useStore.getState().finishOrganize()
    useStore.getState().startExtract()
    useStore.getState().finishExtract()
    expect(view()).toBe('assetConfirm')
    expect(step()).toBe(2)
  })

  it('确认拆分 → splitting **立刻归 ③** → 跑完落 storyboard', () => {
    useStore.getState().beginOrganize()
    useStore.getState().finishOrganize()
    useStore.getState().startExtract()
    useStore.getState().finishExtract()

    useStore.getState().beginSplit('standard')
    expect(view()).toBe('splitting')
    expect(step()).toBe(3)

    useStore.getState().finishSplit()
    expect(view()).toBe('storyboard')
    expect(step()).toBe(3)
  })

  it('步骤条跳转：切一个字段就够（以前要同时推相位与步骤两个）', () => {
    useStore.getState().setAnalysisView('assetConfirm')
    expect(step()).toBe(2)
    useStore.getState().setAnalysisView('episodes')
    expect(step()).toBe(1)
  })
})
