import { useStore } from '../store/useStore'
import type { Asset, BaseAssetKind } from '../data/types'
import { KIND_LABEL } from '../components/entity'
import { firstBatchAssets, isProductionStale, isScriptStale } from '../services/production'
import s from './VisualPrep.module.css'

const ORDER: BaseAssetKind[] = ['character', 'costume', 'location', 'prop']

// 阶段② 简版：只渲染四类基础资产（第一批），着装角色不展示。
// 状态为 Demo：待生成 / 已生成（点一下切换）/ 需重新生成（上游改了提示词后自动出现）。
export function VisualPrep() {
  const project = useStore((st) => st.project)
  const setPage = useStore((st) => st.setPage)
  const producedIds = useStore((st) => st.producedIds)
  const markProduced = useStore((st) => st.markAssetProduced)

  const base = firstBatchAssets(project)
  const snapshot = project.productionSnapshot
  const scriptStale = isScriptStale(project)

  const statusOf = (a: Asset): 'stale' | 'done' | 'queued' =>
    isProductionStale(a) ? 'stale' : producedIds.includes(a.id) ? 'done' : 'queued'

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div className={s.headRow}>
          <div className={s.h1}>视觉筹备 · 第一批资产生产</div>
          <button className={s.back} onClick={() => setPage('analysis')}>
            ← 返回剧本分析
          </button>
        </div>
        <div className={s.sub}>
          第一批只生成素模角色、服装、场景与道具四类基础资产；着装角色在基础资产定稿后另行生成，本页不展示。
          返回剧本分析修改提示词后，受影响的资产会标记「需重新生成」。
        </div>
        <div className={s.stat}>
          <span>
            基础资产 <b>{base.length}</b> 项
          </span>
          {snapshot && (
            <span>
              快照脚本版本 <b>v{snapshot.sourceScriptRevision}</b>
            </span>
          )}
        </div>
        {scriptStale && (
          <div className={s.staleNote}>
            ⚠ 脚本已在下发后修改（当前 v{project.scriptRevision}），后续流程需重新同步。
          </div>
        )}
      </div>

      <div className={s.scroll}>
        {ORDER.map((kind) => {
          const list = base.filter((a) => a.kind === kind)
          if (list.length === 0) return null
          return (
            <div className={s.section} key={kind}>
              <div className={s.stitle}>
                <b>{KIND_LABEL[kind]}</b>
                <span>{list.length} 项</span>
              </div>
              <div className={s.grid}>
                {list.map((a) => {
                  const status = statusOf(a)
                  const badgeClass =
                    status === 'stale' ? s.badgeStale : status === 'done' ? s.badgeDone : s.badgeQueued
                  const badgeText = status === 'stale' ? '需重新生成' : status === 'done' ? '已生成' : '待生成'
                  return (
                    <div key={a.id} className={s.item}>
                      <div className={s.itemHead}>
                        <span className={s.nm}>{a.name}</span>
                        <button
                          className={[s.badge, badgeClass].join(' ')}
                          onClick={() => markProduced(a.id)}
                          title="点击切换为「已生成」（Demo 状态）"
                        >
                          {badgeText}
                        </button>
                      </div>
                      <div className={s.desc}>{a.imagePrompt}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
