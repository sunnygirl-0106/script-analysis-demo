import { useStore } from '../store/useStore'
import type { Asset, AssetKind } from '../data/types'
import { KIND_LABEL } from '../components/entity'
import s from './VisualPrep.module.css'

const KIND_ORDER: AssetKind[] = ['character', 'costume', 'location', 'prop']

// 每类资产的参考图规格不同（交接文档 10.2 第二条）。占位图形状按规格区分，不共用方图。
const SPEC: Record<AssetKind, { note: string; shape: string; slots: number }> = {
  character: { note: '纯白背景三视图（正 / 侧 / 背全身站姿）+ 特写', shape: s.shapeChar!, slots: 3 },
  costume: { note: '纯白背景平铺 / 挂拍，正背两面，无人物', shape: s.shapeCostume!, slots: 2 },
  location: { note: '横版空镜，无人物', shape: s.shapeScene!, slots: 1 },
  prop: { note: '纯白背景产品图', shape: s.shapeProp!, slots: 1 },
}

// 阶段② 简版：全部资产一律进生图队列（无排除项），按四分类展示各自的参考图规格差异。
export function VisualPrep() {
  const assets = useStore((st) => st.project.assets)
  const total = Object.keys(assets).length

  const grouped = (kind: AssetKind): Asset[] =>
    Object.values(assets).filter((a) => a.kind === kind)

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div className={s.h1}>视觉筹备 · 生图队列</div>
        <div className={s.sub}>
          四类资产的每一项都进生图队列，没有例外。每类的参考图规格不同 —— 角色三视图、服装平铺双面、场景空镜、道具产品图。
        </div>
        <div className={s.stat}>
          <span>
            资产 <b>{total}</b> 项
          </span>
        </div>
      </div>

      <div className={s.scroll}>
        {KIND_ORDER.map((kind) => {
          const list = grouped(kind)
          if (list.length === 0) return null
          const spec = SPEC[kind]
          return (
            <div className={s.section} key={kind}>
              <div className={s.stitle}>
                <b>{KIND_LABEL[kind]}</b>
                <span>{list.length} 项 · {spec.note}</span>
              </div>
              <div className={s.grid}>
                {list.map((a) => (
                  <div key={a.id} className={s.item}>
                    <div className={s.itemHead}>
                      <span className={s.nm}>{a.name}</span>
                      <span className={[s.badge, s.badgeQueued].join(' ')}>待生图</span>
                    </div>
                    <div className={[s.thumb, spec.shape].join(' ')}>
                      {Array.from({ length: spec.slots }, (_, i) => (
                        <span key={i} className={s.slot} />
                      ))}
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
