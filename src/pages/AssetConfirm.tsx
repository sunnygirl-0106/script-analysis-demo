import { Fragment, useState, type ReactNode } from 'react'
import { useStore, type Tab } from '../store/useStore'
import type { AssetKind } from '../data/types'
import { KIND_DOT, KIND_LABEL } from '../components/entity'
import { can } from '../services/capability'
import ui from '../styles/ui.module.css'
import s from './AssetConfirm.module.css'

// 阶段② 完整确认：解析结果先落 candidates，用户确认后才入库（v2.0）。
// 与 ScriptAnalysis（阶段③ 分镜表）是两个界面；这里没有 shots，也没有集/场/镜。

const KINDS: AssetKind[] = ['character', 'costume', 'location', 'prop']

// 用候选名 + 别名把全剧原文里的实体高亮（阶段②资产还在候选里，不在 project.assets）。
function highlight(text: string, terms: { term: string; kind: AssetKind }[]): ReactNode {
  const sorted = terms.filter((t) => t.term.length >= 2).sort((a, b) => b.term.length - a.term.length)
  if (!sorted.length) return text
  const escaped = sorted.map((t) => t.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`(${escaped.join('|')})`, 'g')
  return text.split(re).map((part, i) => {
    const hit = sorted.find((t) => t.term === part)
    return hit
      ? <span key={i} className={s.hl} style={{ color: KIND_DOT[hit.kind] }}>{part}</span>
      : <Fragment key={i}>{part}</Fragment>
  })
}

function toBeats(raw: string): string[] {
  return raw.split('\n').map((l) => l.trim()).filter(Boolean)
}

export function AssetConfirm() {
  const project = useStore((st) => st.project)
  const candidates = useStore((st) => st.candidates)
  const activeTab = useStore((st) => st.activeTab)
  const setTab = useStore((st) => st.setTab)
  const renameCandidate = useStore((st) => st.renameCandidate)
  const removeCandidate = useStore((st) => st.removeCandidate)
  const addManualCandidate = useStore((st) => st.addManualCandidate)
  const commitLibrary = useStore((st) => st.commitLibrary)
  const startSplit = useStore((st) => st.startSplit)
  const showToast = useStore((st) => st.showToast)

  const committed = project.libraryCommittedAt != null
  const canReupload = can(project, 'replaceWholeScript') // 等价于「未入库」

  const kind: AssetKind = (KINDS as string[]).includes(activeTab) ? (activeTab as AssetKind) : 'character'
  const [adding, setAdding] = useState('')

  const candOf = (k: AssetKind) => candidates.filter((c) => c.kind === k)
  const committedOf = (k: AssetKind) => Object.values(project.assets).filter((a) => a.kind === k)
  const newCount = candidates.filter((c) => c.decision === 'new').length

  // 高亮词表：候选名 + 已入库资产名（都参与原文标注）。
  const terms = [
    ...candidates.map((c) => ({ term: c.name, kind: c.kind, aliases: c.aliases })),
    ...Object.values(project.assets).map((a) => ({ term: a.name, kind: a.kind, aliases: a.aliases })),
  ].flatMap((t) => [{ term: t.term, kind: t.kind }, ...((t.aliases ?? []).map((al) => ({ term: al, kind: t.kind })))])

  // 全剧原文：按集 → 场顺序连读（阶段②只有场结构，没有分镜）。
  const scenesInOrder = project.episodes.flatMap((e) => e.sceneIds.map((id) => project.scenes[id]).filter(Boolean))

  const tabs: { key: Tab; label: string; n: number }[] = KINDS.map((k) => ({
    key: k as Tab,
    label: KIND_LABEL[k],
    n: candOf(k).length + committedOf(k).length,
  }))

  const doAdd = () => {
    const name = adding.trim()
    if (!name) return
    addManualCandidate(kind, name)
    setAdding('')
  }

  return (
    <div className={s.page}>
      {/* 左：全剧原文 */}
      <div className={s.scriptCol}>
        <div className={s.scriptHead}>
          全剧原文
          <span className={s.scriptMeta}>共 {scenesInOrder.length} 场 · 阶段② 尚未拆分镜头</span>
        </div>
        <div className={s.scriptBody}>
          {scenesInOrder.map((sc) => (
            <div key={sc!.id} className={s.sceneBlock}>
              <div className={s.sceneTitle}>第 {sc!.no} 场 · {sc!.name}</div>
              {toBeats(sc!.rawText).map((beat, i) => (
                <p key={i} className={s.beat}>{highlight(beat, terms)}</p>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* 右：候选清单 */}
      <div className={s.rcol}>
        <div className={s.tabs}>
          {tabs.map((t) => (
            <button
              key={t.key}
              className={[s.tab, activeTab === t.key ? s.tabOn : ''].join(' ')}
              onClick={() => setTab(t.key)}
            >
              {t.label}<i className={s.tabN}>{t.n}</i>
            </button>
          ))}
        </div>

        <div className={s.listScroll}>
          <div className={s.colHead}>
            <span />
            <span>名称</span>
            <span>出场</span>
            <span>状态</span>
            <span />
          </div>

          {/* 待入库候选 */}
          {candOf(kind).map((c) => (
            <div key={c.tempId} className={s.row}>
              <i className={s.dot} style={{ background: KIND_DOT[c.kind] }} />
              <EditableName
                name={c.name}
                editable={!committed}
                onCommit={(v) => renameCandidate(c.tempId, v)}
              />
              <span className={s.occ}>
                全剧 {c.occCount ?? 0} 处{c.firstParaNo ? ` · 首现第 ${c.firstParaNo} 段` : ''}
              </span>
              <span className={s.stPending}>待入库</span>
              <button
                className={s.iconBtn}
                disabled={committed}
                title="移除此候选"
                onClick={() => removeCandidate(c.tempId)}
              >🗑</button>
            </div>
          ))}

          {/* 已入库条目：只读灰显 */}
          {committedOf(kind).map((a) => (
            <div key={a.id} className={[s.row, s.rowLocked].join(' ')}>
              <i className={s.dot} style={{ background: KIND_DOT[a.kind] }} />
              <span className={s.name}>{a.name}</span>
              <span className={s.occ}>已入库</span>
              <span className={s.stSaved}>已入库</span>
              <button className={s.iconBtn} disabled title="删除只有项目资产库一个出口">🗑</button>
            </div>
          ))}

          {candOf(kind).length + committedOf(kind).length === 0 && (
            <div className={s.empty}>本类目暂无候选</div>
          )}

          {/* 手动补录（仅未入库时） */}
          {!committed && (
            <div className={s.addRow}>
              <input
                className={s.addInput}
                placeholder={`手动补录一个${KIND_LABEL[kind]}…`}
                value={adding}
                onChange={(e) => setAdding(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') doAdd() }}
              />
              <button className={ui.btn} disabled={!adding.trim()} onClick={doAdd}>＋ 补录</button>
            </div>
          )}
        </div>

        {/* 页脚 */}
        <div className={s.foot}>
          <button
            className={ui.btn}
            disabled={!canReupload}
            title={canReupload ? '换一份剧本重新拆解' : '已保存到项目资产库；换一部剧本请新建项目'}
            onClick={() => canReupload
              ? showToast('重新上传：请从空态点「导入剧本」重来（演示占位）')
              : undefined}
          >
            ↺ 重新上传剧本
          </button>
          {!committed ? (
            <button className={[ui.btn, ui.btnPrimary].join(' ')} onClick={commitLibrary}>
              确认并保存到项目资产库（{newCount} 项）→
            </button>
          ) : (
            <button className={[ui.btn, ui.btnPrimary].join(' ')} onClick={() => startSplit({})}>
              开始拆分集 / 场 / 镜 →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function EditableName({
  name, editable, onCommit,
}: { name: string; editable: boolean; onCommit: (next: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [v, setV] = useState(name)
  if (!editable) return <span className={s.name}>{name}</span>
  if (editing) {
    return (
      <input
        className={s.nmInput}
        value={v}
        autoFocus
        onChange={(e) => setV(e.target.value)}
        onBlur={() => { onCommit(v); setEditing(false) }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          else if (e.key === 'Escape') { setV(name); setEditing(false) }
        }}
      />
    )
  }
  return (
    <span className={s.name} title="点击改名" onClick={() => { setV(name); setEditing(true) }}>
      {name} <span className={s.pencil}>✎</span>
    </span>
  )
}
