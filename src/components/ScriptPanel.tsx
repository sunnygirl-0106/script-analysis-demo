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

// 原文按自然段拆成「beat」，供左侧段号栏逐段标号。空行不占号。
function toBeats(raw: string): string[] {
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
}

// 秒 → mm:ss
function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function ScriptPanel() {
  const project = useStore((st) => st.project)
  const sceneId = useStore((st) => st.selectedSceneId)
  const open = useStore((st) => st.scriptOpen)
  const toggle = useStore((st) => st.toggleScript)
  const scriptW = useStore((st) => st.scriptW)

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

  const beats = scene ? toBeats(scene.rawText) : []
  const shotCount = scene?.shotIds.length ?? 0
  const totalSec = scene
    ? scene.shotIds.reduce((sum, id) => sum + (project.shots[id]?.duration ?? 0), 0)
    : 0

  return (
    <div className={s.col} style={{ width: scriptW }}>
      <div className={s.head}>
        <span className={s.lbl}>本场剧本</span>
        <span className={s.lock} tabIndex={0} aria-label="剧本原文不可编辑，如需修改请重新导入">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" />
            <path d="M12 14.5v2" strokeLinecap="round" />
          </svg>
          <span className={s.tip}>剧本原文不可编辑，如需修改请重新导入</span>
        </span>
        {scene && (
          <span className={s.meta}>
            {shotCount} 镜 · {fmtDuration(totalSec)}
          </span>
        )}
        <button className={s.fold} onClick={toggle} title="收起">
          ⊟
        </button>
      </div>
      <div className={s.script}>
        {scene && (
          <div className={s.masthead}>
            <div className={s.eyebrow}>SCENE {String(scene.no).padStart(2, '0')}</div>
            <div className={s.title}>{scene.name}</div>
          </div>
        )}
        {beats.length > 0 ? (
          beats.map((beat, i) => (
            <div className={s.beat} key={i}>
              <span className={s.n}>{String(i + 1).padStart(2, '0')}</span>
              <p>{highlight(beat, assets)}</p>
            </div>
          ))
        ) : (
          <div className={s.beat}>
            <p>—</p>
          </div>
        )}
      </div>
    </div>
  )
}
