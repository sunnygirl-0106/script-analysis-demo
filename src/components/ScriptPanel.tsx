import { Fragment, type ReactNode } from 'react'
import { useStore } from '../store/useStore'
import type { Asset, AssetKind } from '../data/types'
import s from './ScriptPanel.module.css'

const kindClass: Record<AssetKind, string> = {
  character: s.role!,
  costume: s.cloth!,
  location: s.scene!,
  prop: s.prop!,
  look: s.role!, // 着装角色沿用角色紫（原文里一般不会命中 look 名，仅为类型完备）
}

// 用每个资产的「编目名 + 剧本别名」把原文里的实体高亮。
// 编目名（智能手机）常与原文口语（手机）对不上，所以两者都参与匹配。
// 长词优先，避免短词吃掉长词（「外卖」不抢「外卖员」，「苏可」不抢「苏可可」）。
function highlight(text: string, assets: Asset[]): ReactNode {
  const terms = assets
    .flatMap((a) => [a.name, ...(a.aliases ?? [])].map((term) => ({ term, kind: a.kind })))
    .filter((t) => t.term.length >= 2)
    .sort((a, b) => b.term.length - a.term.length)
  if (terms.length === 0) return text

  const escaped = terms.map((t) => t.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`(${escaped.join('|')})`, 'g')
  const parts = text.split(re)
  return parts.map((part, i) => {
    const hit = terms.find((t) => t.term === part)
    if (hit) {
      return (
        <span key={i} className={[s.e, kindClass[hit.kind]].join(' ')}>
          {part}
        </span>
      )
    }
    return <Fragment key={i}>{part}</Fragment>
  })
}

export function ScriptPanel() {
  const project = useStore((st) => st.project)
  const sceneId = useStore((st) => st.selectedSceneId)
  const open = useStore((st) => st.scriptOpen)
  const toggle = useStore((st) => st.toggleScript)

  const scene = project.scenes[sceneId]
  const assets = Object.values(project.assets)

  if (!open) {
    return (
      <div className={s.stripe} onClick={toggle} title="展开本场剧本">
        <span className={s.plus}>⊞</span>
        <span className={s.v}>本场剧本</span>
      </div>
    )
  }

  return (
    <div className={s.col}>
      <div className={s.head}>
        本场剧本
        <span className={s.rt}>
          <button
            style={{ border: 'none', background: 'none', color: 'var(--t4)', cursor: 'pointer', fontSize: 13 }}
            onClick={toggle}
            title="收起"
          >
            ⊟
          </button>
        </span>
      </div>
      <div className={s.script}>{scene ? highlight(scene.rawText, assets) : '—'}</div>
    </div>
  )
}
