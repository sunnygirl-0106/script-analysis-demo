import type { AssetSyncState } from '../services/staleness'
import s from './AssetList.module.css'

// 单向传播的派生状态徽章：
//   draft     → 待生成（灰点）
//   delivered → 已交付（主色点）
//   stale     → 提示词已修改 · 下游需重新生成（琥珀，决策 6.1）
// compact：资产表「状态」列用，统一成「小圆点 + 短词」，完整说明走 title。
export function SyncBadge({ state, compact }: { state: AssetSyncState; compact?: boolean }) {
  if (compact) {
    if (state === 'stale') {
      return (
        <span className={s.badgeStaleSm} title="提示词已更新，之前生成的图片不会自动更新，请重新生成">
          <i className={s.dotAmber} />待更新
        </span>
      )
    }
    if (state === 'delivered') {
      return <span className={s.badgeDelivered}><i className={s.dotAcc} />已生成</span>
    }
    return <span className={s.badgeDraft}><i className={s.dotMuted} />待生成</span>
  }

  if (state === 'stale') {
    return <span className={s.badgeStale} title="提示词已更新，之前生成的图片不会自动更新">⚠ 内容已更新 · 请重新生成</span>
  }
  if (state === 'delivered') {
    return <span className={s.badgeDelivered}><i className={s.dotAcc} />已生成</span>
  }
  return <span className={s.badgeDraft}><i className={s.dotMuted} />待生成</span>
}
