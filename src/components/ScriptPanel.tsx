import { Fragment, type ReactNode } from 'react'
import { useStore } from '../store/useStore'
import type { Asset, AssetKind } from '../data/types'
import s from './ScriptPanel.module.css'

const kindClass: Record<AssetKind, string> = {
  character: s.role!,
  costume: s.cloth!,
  location: s.scene!,
  prop: s.prop!,
}

// 用剧本里真实出现的资产名把原文里的实体高亮（长名优先，避免「苏可」吃掉「苏可可」）。
function highlight(text: string, assets: Asset[]): ReactNode {
  const names = assets
    .map((a) => ({ name: a.name, kind: a.kind }))
    .filter((n) => n.name.length >= 2)
    .sort((a, b) => b.name.length - a.name.length)
  if (names.length === 0) return text

  const escaped = names.map((n) => n.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`(${escaped.join('|')})`, 'g')
  const parts = text.split(re)
  return parts.map((part, i) => {
    const hit = names.find((n) => n.name === part)
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
