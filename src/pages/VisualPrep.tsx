import { useStore } from '../store/useStore'
import type { Asset, AssetKind } from '../data/types'
import { imageGenQueue } from '../services/imageQueue'
import { KIND_LABEL } from '../components/entity'
import s from './VisualPrep.module.css'

const KIND_ORDER: AssetKind[] = ['character', 'costume', 'location', 'prop']

// 阶段② 简版：把「生图队列」实拍出来，直接体现 R7 不生图开关的效果。
export function VisualPrep() {
  const assets = useStore((st) => st.project.assets)
  const queue = imageGenQueue(assets)
  const queuedIds = new Set(queue.map((a) => a.id))

  const excludedCount = Object.keys(assets).length - queue.length

  const grouped = (kind: AssetKind): Asset[] =>
    Object.values(assets).filter((a) => a.kind === kind)

  const inQueue = (a: Asset) => queuedIds.has(a.id)

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div className={s.h1}>视觉筹备 · 生图队列</div>
        <div className={s.sub}>
          队列 = 所有资产 − 标了「不用生图」的角色 − 次要道具。在剧本分析页切换这些开关，这里的队列会实时增减。
        </div>
        <div className={s.stat}>
          <span>
            待生图 <b>{queue.length}</b> 项
          </span>
          <span>已排除 {excludedCount} 项</span>
        </div>
      </div>

      <div className={s.scroll}>
        {KIND_ORDER.map((kind) => {
          const list = grouped(kind)
          if (list.length === 0) return null
          const queuedN = list.filter(inQueue).length
          return (
            <div className={s.section} key={kind}>
              <div className={s.stitle}>
                <b>{KIND_LABEL[kind]}</b>
                <span>
                  {queuedN}/{list.length} 进队列
                </span>
              </div>
              <div className={s.grid}>
                {list.map((a) => {
                  const queued = inQueue(a)
                  return (
                    <div key={a.id} className={[s.item, queued ? '' : s.excluded].join(' ')}>
                      <div className={s.itemHead}>
                        <span className={s.nm}>{a.name}</span>
                        <span className={[s.badge, queued ? s.badgeQueued : s.badgeSkip].join(' ')}>
                          {queued ? '待生图' : '跳过'}
                        </span>
                      </div>
                      <div className={s.thumb}>{queued ? '待生成关键帧' : '不生图'}</div>
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
