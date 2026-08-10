// R1 时长是累计时间轴。纯函数，不 import 任何 React。
// 规则版本：v1.0（2026-08-10）。断言见 tests/rules.test.ts 的 R1。
import type { Scene, Shot } from '../data/types'

export interface TimelineEntry {
  shotId: string
  startAt: number
  endAt: number
}

/**
 * 每个镜的 startAt = 本场前面所有镜时长之和。
 * 改任何一个镜的时长，后面所有镜的 startAt 全部顺移。
 */
export function computeTimeline(scene: Scene, shots: Record<string, Shot>): TimelineEntry[] {
  const out: TimelineEntry[] = []
  let cursor = 0
  for (const shotId of scene.shotIds) {
    const shot = shots[shotId]
    if (!shot) continue
    const startAt = cursor
    const endAt = startAt + shot.duration
    out.push({ shotId, startAt, endAt })
    cursor = endAt
  }
  return out
}

/** 场总时长 = 本场所有镜时长之和。 */
export function sceneDuration(scene: Scene, shots: Record<string, Shot>): number {
  return scene.shotIds.reduce((sum, id) => sum + (shots[id]?.duration ?? 0), 0)
}
