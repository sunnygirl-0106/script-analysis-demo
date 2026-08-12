import { useStore } from '../store/useStore'
import { FIRST_BATCH_KINDS, type Asset } from '../data/types'
import { KIND_LABEL } from '../components/entity'
import s from './VisualPrep.module.css'

// 阶段② 简版：队列 = 第一批四类基础资产 ∩ 未排除（决策 2b）。着装角色不进第一批，不在此出现。
// 其余逻辑一律不动，保持简单（决策 6.2）。
export function VisualPrep() {
  const assets = useStore((st) => st.project.assets)

  const grouped = (kind: string): Asset[] =>
    Object.values(assets).filter((a) => a.kind === kind && !a.excluded)

  const total = FIRST_BATCH_KINDS.reduce((n, k) => n + grouped(k).length, 0)

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div className={s.h1}>视觉筹备 · 生图队列</div>
        <div className={s.sub}>
          第一批只生产四类基础资产：角色素模、服装、场景、道具。着装角色需素模与服装出图确认后，在后续批次生成。
        </div>
        <div className={s.stat}>
          <span>
            本批 <b>{total}</b> 项
          </span>
        </div>
      </div>

      <div className={s.scroll}>
        {FIRST_BATCH_KINDS.map((kind) => {
          const list = grouped(kind)
          if (list.length === 0) return null
          return (
            <div className={s.section} key={kind}>
              <div className={s.stitle}>
                <b>{KIND_LABEL[kind]}</b>
                <span>{list.length} 项</span>
              </div>
              <div className={s.grid}>
                {list.map((a) => (
                  <div key={a.id} className={s.item}>
                    <div className={s.itemHead}>
                      <span className={s.nm}>{a.name}</span>
                      <span className={[s.badge, s.badgeQueued].join(' ')}>待生图</span>
                    </div>
                    <div className={s.thumb}>
                      <span className={s.slot} />
                    </div>
                    <div className={s.desc}>{a.imagePrompt}</div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
