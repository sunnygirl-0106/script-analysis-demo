import type { AssetSyncState } from '../services/staleness'
import s from './AssetList.module.css'

// 单向传播的派生状态徽章：
//   draft     → 待生成（灰点）
//   delivered → 已交付（主色点）
//   stale     → 提示词已修改 · 下游需重新生成（琥珀描边，决策 6.1）
export function SyncBadge({ state }: { state: AssetSyncState }) {
  if (state === 'stale') {
    return <span className={s.badgeStale} title="提示词已修改，下游生成结果已过期">⚠ 已改 · 下游需重生成</span>
  }
  if (state === 'delivered') {
    return <span className={s.badgeDelivered}><i className={s.dotAcc} />已交付</span>
  }
  return <span className={s.badgeDraft}><i className={s.dotMuted} />待生成</span>
}
