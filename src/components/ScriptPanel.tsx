import { Fragment, type ReactNode } from 'react'
import { useStore } from '../store/useStore'
import type { Asset, AssetKind, Scene } from '../data/types'
import { assetMatcher } from '../services/mentions'
import { scopeLabel, scopeScenes } from '../services/viewScope'
import s from './ScriptPanel.module.css'

const kindClass: Record<AssetKind, string> = {
  character: s.role!,
  costume: s.cloth!,
  location: s.scene!,
  prop: s.prop!,
  look: s.role!, // 着装角色沿用角色紫（原文里一般不会命中 look 名，仅为类型完备）
}

// 用每个资产的「编目名 + 剧本别名」把原文里的实体高亮。
// 词表编译与长词优先的口径统一在 services/mentions 的 assetMatcher 里（按 assets 引用记忆化），
// 不再各建各的正则。
function highlight(text: string, assets: Record<string, Asset>): ReactNode {
  const m = assetMatcher(assets)
  if (!m) return text
  return text.split(m.re).map((part, i) => {
    const hit = m.byTerm.get(part)
    if (!hit) return <Fragment key={i}>{part}</Fragment>
    return (
      <span key={i} className={[s.e, kindClass[hit.kind]].join(' ')}>
        {part}
      </span>
    )
  })
}

// 原文按自然段拆开。**只保留自然段落，不再切成带编号带分隔线的「beat」块**——
// 步骤③ 看的是某一场的原文，连续读下去就行，段号栏和分隔线在这儿只是噪音。
function toBeats(raw: string): string[] {
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
}

const CN_DIGITS = '零一二三四五六七八九'

/** 阿拉伯数字 → 中文数字。场号用，1–99 足够；超出范围原样返回阿拉伯数字，不硬凑。 */
function cnNum(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 99) return String(n)
  if (n < 10) return CN_DIGITS[n]!
  const tens = Math.floor(n / 10)
  const ones = n % 10
  return `${tens > 1 ? CN_DIGITS[tens]! : ''}十${ones ? CN_DIGITS[ones]! : ''}`
}

// 秒 → mm:ss
function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// 剧本面板（v2.7 §5.5）：跟着左侧目录的视图作用域走。
// 全剧 / 本集视图依次铺开范围内每一场的原文（每场一个报头 + 正文），本场视图只有一场。
// 标题也跟着变（全剧剧本 / 本集剧本 / 本场剧本）——右边表格铺的是三场，
// 左边却写着「本场剧本」，那是两个页面在说不同的话。
export function ScriptPanel() {
  const project = useStore((st) => st.project)
  const viewScope = useStore((st) => st.viewScope)
  const open = useStore((st) => st.scriptOpen)
  const toggle = useStore((st) => st.toggleScript)
  const scriptW = useStore((st) => st.scriptW)

  const label = `${scopeLabel(viewScope)}剧本`
  const scenes = scopeScenes(project, viewScope)
  const assets = project.assets

  if (!open) {
    return (
      <div className={s.stripe} onClick={toggle} title={`展开${label}`}>
        <span className={s.plus}>⊞</span>
        <span className={s.v}>{label}</span>
      </div>
    )
  }

  const shotCount = scenes.reduce((n, sc) => n + sc.shotIds.length, 0)
  const totalSec = scenes.reduce(
    (sum, sc) => sum + sc.shotIds.reduce((n, id) => n + (project.shots[id]?.duration ?? 0), 0),
    0,
  )

  return (
    <div className={s.col} style={{ width: scriptW }}>
      <div className={s.head}>
        <span className={s.lbl}>{label}</span>
        <span className={s.lock} tabIndex={0} aria-label="剧本原文不可编辑，如需修改请重新导入">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" />
            <path d="M12 14.5v2" strokeLinecap="round" />
          </svg>
          <span className={s.tip}>剧本原文不可编辑，如需修改请重新导入</span>
        </span>
        {scenes.length > 0 && (
          <span className={s.meta}>
            {shotCount} 镜 · {fmtDuration(totalSec)}
          </span>
        )}
        <button className={s.fold} onClick={toggle} title="收起">
          ⊟
        </button>
      </div>
      <div className={s.script}>
        {scenes.map((sc) => (
          <SceneScript key={sc.id} scene={sc} assets={assets} />
        ))}
        {scenes.length === 0 && (
          <div className={s.body}>
            <p>—</p>
          </div>
        )}
      </div>
    </div>
  )
}

/** 一场原文：小报头 + 连续正文。 */
function SceneScript({ scene, assets }: { scene: Scene; assets: Record<string, Asset> }) {
  const beats = toBeats(scene.rawText)
  return (
    <>
      <div className={s.masthead}>
        <div className={s.eyebrow}>第{cnNum(scene.no)}场</div>
        <div className={s.title}>{scene.name}</div>
      </div>
      <div className={s.body}>
        {beats.length > 0 ? (
          beats.map((beat, i) => <p key={i}>{highlight(beat, assets)}</p>)
        ) : (
          <p>—</p>
        )}
      </div>
    </>
  )
}
