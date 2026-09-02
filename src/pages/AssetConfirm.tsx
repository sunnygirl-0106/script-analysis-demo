import { Fragment, useMemo, useState, type ReactNode } from 'react'
import { useStore, type Tab } from '../store/useStore'
import type { Asset, AssetKind, CandidateAsset } from '../data/types'
import { KIND_DOT, KIND_LABEL } from '../components/entity'
import { can } from '../services/capability'
import { refState } from '../services/reference'
import { fmtCost, costSplit } from '../services/cost'
import { PanelResizer } from '../components/PanelResizer'
import { CandidatePromptDialog } from '../components/CandidatePromptDialog'
import { ReuploadDialog } from '../components/ReuploadDialog'
import { StartSplitDialog } from '../components/StartSplitDialog'
import ui from '../styles/ui.module.css'
import s from './AssetConfirm.module.css'

// 阶段② 完整确认（v2.0 + v2.3 §三）：解析结果先落 candidates，用户确认后才入库。
// 与 ScriptAnalysis（阶段③ 分镜表）是两个界面；这里没有 shots，也没有集/场/镜。
// 表格只留三类信息：名称 | 生成提示词 | 状态 | 操作；「在剧本中出现」列与名下小字都已删（§3.3）。

const KINDS: AssetKind[] = ['character', 'costume', 'location', 'prop']

const normalize = (t: string) => t.replace(/\s+/g, '').toLowerCase()

type SortKey = 'occ' | 'first' | 'name'
const SORT_LABEL: Record<SortKey, string> = { occ: '按出现次数', first: '按首次出现', name: '按名称' }
// 新增（手动/新建）的候选永远置顶，排序只在同组内生效（§3.4）。
const isManual = (tempId: string) => tempId.startsWith('cand_manual_')

// 左原文栏宽度：可拖拽（§3.2），夹取在这个范围内。
const SCRIPT_MIN = 300
const SCRIPT_MAX = 720

// 用候选名 + 别名把全剧原文里的实体高亮（阶段②资产还在候选里，不在 project.assets）。
//
// ⚠ 这里**刻意**与 EntityText.tsx 的注释（「高亮只往出场的人和物去，不往左边剧本去」）相反：
// 那条规则是为阶段③ 写的——阶段③ 右侧有「出场的人和物」一列可承接联动，左栏又只有本场十几段。
// 阶段② 没有那一列、左栏是全剧几十上百段，「这一条从哪儿抽出来的」只能靠原文联动回答，
// 所以联动就是答案，不是噪音。hover 整行点亮左侧名字这个联动要保留（§3.3）。
function highlight(
  text: string,
  terms: { term: string; kind: AssetKind }[],
  hotSet: Set<string>,
): ReactNode {
  const sorted = terms.filter((t) => t.term.length >= 2).sort((a, b) => b.term.length - a.term.length)
  if (!sorted.length) return text
  const escaped = sorted.map((t) => t.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`(${escaped.join('|')})`, 'g')
  return text.split(re).map((part, i) => {
    const hit = sorted.find((t) => t.term === part)
    if (!hit) return <Fragment key={i}>{part}</Fragment>
    const on = hotSet.has(normalize(part))
    return (
      <span
        key={i}
        className={[s.hl, on ? s.on : ''].join(' ')}
        data-term={normalize(part)}
        style={{ color: KIND_DOT[hit.kind] }}
      >
        {part}
      </span>
    )
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
  const hoverAssetTerm = useStore((st) => st.hoverAssetTerm)
  const setHoverAssetTerm = useStore((st) => st.setHoverAssetTerm)
  const usageIndex = useStore((st) => st.usageIndex())

  const committed = project.libraryCommittedAt != null
  const canReupload = can(project, 'replaceWholeScript') // 等价于「未入库」

  const kind: AssetKind = (KINDS as string[]).includes(activeTab) ? (activeTab as AssetKind) : 'character'
  const [reuploadOpen, setReuploadOpen] = useState(false)
  const [splitOpen, setSplitOpen] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('occ')
  const [scriptW, setScriptW] = useState(460)

  const candOf = (k: AssetKind) => candidates.filter((c) => c.kind === k)
  const committedOf = (k: AssetKind) => Object.values(project.assets).filter((a) => a.kind === k)
  const newCount = candidates.filter((c) => c.decision === 'new').length
  const splitCost = useMemo(
    () => costSplit(project.episodes.flatMap((e) => e.sceneIds), project.defaultDensity),
    [project.episodes, project.defaultDensity],
  )

  // 高亮词表：候选名 + 已入库资产名（都参与原文标注）。
  const terms = [
    ...candidates.map((c) => ({ term: c.name, kind: c.kind, aliases: c.aliases })),
    ...Object.values(project.assets).map((a) => ({ term: a.name, kind: a.kind, aliases: a.aliases })),
  ].flatMap((t) => [{ term: t.term, kind: t.kind }, ...((t.aliases ?? []).map((al) => ({ term: al, kind: t.kind })))])

  // 当前 hover 的资产要点亮的名字集合（归一化）。
  const hotSet = useMemo(
    () => new Set((hoverAssetTerm?.terms ?? []).map(normalize)),
    [hoverAssetTerm],
  )

  // 全剧原文：按集 → 场顺序连读（阶段②只有场结构，没有分镜）。
  const scenesInOrder = project.episodes.flatMap((e) => e.sceneIds.map((id) => project.scenes[id]).filter(Boolean))

  // 悬浮：只点亮名字，不滚动（hover 就滚会晕）。
  const enter = (names: (string | undefined)[]) =>
    setHoverAssetTerm({ terms: names.filter((n): n is string => !!n) })
  const leave = () => setHoverAssetTerm(null)

  const tabs: { key: Tab; label: string; n: number }[] = KINDS.map((k) => ({
    key: k as Tab,
    label: KIND_LABEL[k],
    n: candOf(k).length + committedOf(k).length,
  }))

  // 搜索：按名称 / 别名 / 提示词匹配。
  const q = query.trim().toLowerCase()
  const candMatches = (c: CandidateAsset) =>
    !q ||
    c.name.toLowerCase().includes(q) ||
    (c.aliases ?? []).some((a) => a.toLowerCase().includes(q)) ||
    c.imagePrompt.toLowerCase().includes(q)
  const assetMatches = (a: Asset) =>
    !q ||
    a.name.toLowerCase().includes(q) ||
    (a.aliases ?? []).some((x) => x.toLowerCase().includes(q)) ||
    a.imagePrompt.toLowerCase().includes(q)

  // 排序：新增置顶，其余按 sortKey；只在同组（候选 / 已入库）内生效。
  const sortCands = (list: CandidateAsset[]) =>
    [...list].sort((a, b) => {
      const ma = isManual(a.tempId), mb = isManual(b.tempId)
      if (ma !== mb) return ma ? -1 : 1
      if (sortKey === 'name') return a.name.localeCompare(b.name, 'zh')
      if (sortKey === 'first') return (a.firstParaNo ?? 1e9) - (b.firstParaNo ?? 1e9)
      return (b.occCount ?? 0) - (a.occCount ?? 0)
    })
  const sortAssets = (list: Asset[]) =>
    [...list].sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name, 'zh')
      const oa = usageIndex[a.id]?.shotCount ?? 0
      const ob = usageIndex[b.id]?.shotCount ?? 0
      return ob - oa
    })

  const visibleCands = sortCands(candOf(kind).filter(candMatches))
  const visibleAssets = sortAssets(committedOf(kind).filter(assetMatches))

  return (
    <div className={s.page}>
      {/* 左：全剧原文（可拖拽调宽，§3.2） */}
      <div className={s.scriptCol} style={{ width: scriptW }}>
        <div className={s.scriptHead}>
          全剧原文
          <span className={s.scriptMeta}>共 {scenesInOrder.length} 场 · 阶段② 尚未拆分镜头</span>
        </div>
        <div className={[s.scriptBody, hoverAssetTerm ? s.hovering : ''].join(' ')}>
          {scenesInOrder.map((sc) => (
            <div key={sc!.id} className={s.sceneBlock}>
              <div className={s.sceneTitle}>第 {sc!.no} 场 · {sc!.name}</div>
              {toBeats(sc!.rawText).map((beat, i) => (
                <p key={i} className={s.beat}>{highlight(beat, terms, hotSet)}</p>
              ))}
            </div>
          ))}
        </div>
      </div>

      <PanelResizer
        getWidth={() => scriptW}
        onResize={(w) => setScriptW(Math.round(Math.min(SCRIPT_MAX, Math.max(SCRIPT_MIN, w))))}
      />

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

        {/* 工具条：搜索 · 排序 · 新增（§3.4） */}
        <div className={s.toolbar}>
          <div className={s.search}>
            <span className={s.searchIcon}>⌕</span>
            <input
              className={s.searchInput}
              placeholder="搜索名称、别名或提示词"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <label className={s.sortWrap}>
            排序
            <select className={s.sortSel} value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
              {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
                <option key={k} value={k}>{SORT_LABEL[k]}</option>
              ))}
            </select>
          </label>
          {!committed && (
            <button className={s.addBtn} onClick={() => setNewOpen(true)}>＋ 新增{KIND_LABEL[kind]}</button>
          )}
        </div>

        <div className={s.listScroll}>
          <div className={s.colHead}>
            <span />
            <span>名称</span>
            <span>生成提示词</span>
            <span>状态</span>
            <span>操作</span>
          </div>

          {/* 待入库候选 */}
          {visibleCands.map((c) => (
            <CandidateGroup
              key={c.tempId}
              cand={c}
              committed={committed}
              onEnter={() => enter([c.name, ...(c.aliases ?? [])])}
              onLeave={leave}
              onRename={(v) => renameCandidate(c.tempId, v)}
              onRemove={() => removeCandidate(c.tempId)}
            />
          ))}

          {/* 已入库条目：只读灰显 */}
          {visibleAssets.map((a) => {
            const names = [a.name, ...(a.aliases ?? [])]
            const shotCount = usageIndex[a.id]?.shotCount ?? 0
            const unref = refState(usageIndex, a.id) === 'unreferenced'
            return (
              <div
                key={a.id}
                className={[s.row, s.rowLocked].join(' ')}
                onMouseEnter={() => enter(names)}
                onMouseLeave={leave}
              >
                <i className={s.dot} style={{ background: KIND_DOT[a.kind] }} />
                <div className={s.nameCell}><span className={s.name}>{a.name}</span></div>
                <PromptCell title={a.name} text={a.imagePrompt} editable={false} onSave={() => {}} />
                {shotCount > 0 ? (
                  <span className={s.stSaved}>已入库</span>
                ) : (
                  <span className={s.stUnref} title="仍在项目资产库，只是当前剧本没有镜头引用它">
                    {unref ? '未引用' : '已入库'}
                  </span>
                )}
                <div className={s.ops}>
                  <button className={s.iconBtn} disabled title="删除只有项目资产库一个出口">🗑</button>
                </div>
              </div>
            )
          })}

          {visibleCands.length + visibleAssets.length === 0 && (
            <div className={s.empty}>{q ? '没有匹配的资产' : '本类目暂无候选'}</div>
          )}
        </div>

        {/* 页脚：合并成一个动作（§3.5） */}
        <div className={s.foot}>
          <button
            className={ui.btn}
            disabled={!canReupload}
            title={canReupload ? '换一份剧本重新拆解' : '已保存到项目资产库；换一部剧本请新建项目'}
            onClick={() => canReupload && setReuploadOpen(true)}
          >
            ↺ 重新上传剧本
          </button>
          <button
            className={[ui.btn, ui.btnPrimary].join(' ')}
            disabled={committed}
            onClick={() => setSplitOpen(true)}
          >
            确认资产并开始拆分 · {fmtCost(splitCost)}
          </button>
        </div>
      </div>

      {reuploadOpen && <ReuploadDialog count={newCount} onClose={() => setReuploadOpen(false)} />}
      {splitOpen && <StartSplitDialog onClose={() => setSplitOpen(false)} />}
      {newOpen && <NewAssetDialog kind={kind} onClose={() => setNewOpen(false)} />}
    </div>
  )
}

// 提示词单元格（§3.4）：预览一行，点击弹浮层编辑；底下的数据行完全不动。
function PromptCell({
  title, text, editable, onSave, onComplete,
}: {
  title: string
  text: string
  editable: boolean
  onSave: (v: string) => void
  onComplete?: () => void
}) {
  const [open, setOpen] = useState(false)
  const trimmed = text.trim()
  return (
    <>
      <button className={s.promptCell} onClick={() => setOpen(true)} title="点击查看 / 编辑提示词">
        {trimmed ? (
          <span className={s.promptPreview}>{trimmed}</span>
        ) : editable ? (
          <span className={s.promptAdd}>✦ 点击补全提示词</span>
        ) : (
          <span className={s.promptEmpty}>—</span>
        )}
      </button>
      {open && (
        <CandidatePromptDialog
          title={title}
          text={text}
          editable={editable}
          onSave={onSave}
          onComplete={onComplete}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

// 一条候选：主行 + （角色展开时）造型子行。子行是同一张网格的兄弟行，与主行的列对齐（§3.5）。
function CandidateGroup({
  cand, committed, onEnter, onLeave, onRename, onRemove,
}: {
  cand: CandidateAsset
  committed: boolean
  onEnter: () => void
  onLeave: () => void
  onRename: (v: string) => void
  onRemove: () => void
}) {
  const [open, setOpen] = useState(false)
  const isChar = cand.kind === 'character'
  return (
    <>
      <div className={s.row} onMouseEnter={onEnter} onMouseLeave={onLeave}>
        <i className={s.dot} style={{ background: KIND_DOT[cand.kind] }} />
        <div className={s.nameCell}>
          <EditableName name={cand.name} editable={!committed} onCommit={onRename} />
          {isChar && <CandidateLooksToggle cand={cand} open={open} setOpen={setOpen} />}
        </div>
        <CandidateMainPrompt cand={cand} committed={committed} />
        <span className={s.stPending}>待入库</span>
        <div className={s.ops}>
          <button className={s.iconBtn} disabled={committed} title="移除此候选" onClick={onRemove}>🗑</button>
        </div>
      </div>
      {isChar && open && (
        <CandidateLookRows cand={cand} committed={committed} onEnter={onEnter} onLeave={onLeave} />
      )}
    </>
  )
}

// 主行提示词。
function CandidateMainPrompt({ cand, committed }: { cand: CandidateAsset; committed: boolean }) {
  const setCandidatePrompt = useStore((st) => st.setCandidatePrompt)
  const completeCandidatePrompt = useStore((st) => st.completeCandidatePrompt)
  return (
    <PromptCell
      title={cand.name}
      text={cand.imagePrompt}
      editable={!committed}
      onSave={(v) => setCandidatePrompt(cand.tempId, v)}
      onComplete={committed ? undefined : () => completeCandidatePrompt(cand.tempId)}
    />
  )
}

// 角色候选的造型开关：`N 套造型 ⌄` + `＋ 服装`。
function CandidateLooksToggle({
  cand, open, setOpen,
}: { cand: CandidateAsset; open: boolean; setOpen: (v: boolean) => void }) {
  const count = (cand.costumeIds ?? []).length
  const project = useStore((st) => st.project)
  const attachCandidateCostume = useStore((st) => st.attachCandidateCostume)
  const createCandidateCostume = useStore((st) => st.createCandidateCostume)
  const candidates = useStore((st) => st.candidates)
  const committed = project.libraryCommittedAt != null
  const [picking, setPicking] = useState(false)

  // 服装池：本批 costume 候选 + 已入库 costume，去掉已挂的。
  const attached = new Set(cand.costumeIds ?? [])
  const pool = [
    ...candidates.filter((c) => c.kind === 'costume').map((c) => ({ id: c.tempId, name: c.name })),
    ...Object.values(project.assets).filter((a) => a.kind === 'costume').map((a) => ({ id: a.id, name: a.name })),
  ].filter((c) => !attached.has(c.id))

  return (
    <span className={s.looksToggleWrap}>
      {count > 0 && (
        <button className={s.looksToggle} onClick={() => setOpen(!open)}>
          {count} 套造型 <span className={s.caret}>{open ? '⌃' : '⌄'}</span>
        </button>
      )}
      {!committed && (
        <span className={s.addLookWrap}>
          <button className={s.addLook} onClick={() => { setPicking((p) => !p); setOpen(true) }}>
            ＋ 服装
          </button>
          {picking && (
            <CostumePicker
              pool={pool}
              onPick={(id) => { attachCandidateCostume(cand.tempId, id); setPicking(false) }}
              onCreate={(name) => {
                const id = createCandidateCostume(name)
                if (id) attachCandidateCostume(cand.tempId, id)
                setPicking(false)
              }}
              onClose={() => setPicking(false)}
            />
          )}
        </span>
      )}
    </span>
  )
}

// 造型子行（§3.5）：每套造型一条兄弟网格行，靠名列的连接轨归属到上面的角色，
// 并把这套造型自己的「生成提示词」和「状态」跟主行的列对齐带出来。
function CandidateLookRows({
  cand, committed, onEnter, onLeave,
}: {
  cand: CandidateAsset
  committed: boolean
  onEnter: () => void
  onLeave: () => void
}) {
  const project = useStore((st) => st.project)
  const candidates = useStore((st) => st.candidates)
  const detachCandidateCostume = useStore((st) => st.detachCandidateCostume)
  const swapCandidateCostume = useStore((st) => st.swapCandidateCostume)
  const setCandidateLookPrompt = useStore((st) => st.setCandidateLookPrompt)
  const completeCandidateLookPrompt = useStore((st) => st.completeCandidateLookPrompt)
  const ids = cand.costumeIds ?? []
  if (ids.length === 0) return null

  const costumeName = (id: string) =>
    candidates.find((c) => c.tempId === id)?.name ?? project.assets[id]?.name ?? id
  const attached = new Set(ids)
  const swapPool = [
    ...candidates.filter((c) => c.kind === 'costume').map((c) => ({ id: c.tempId, name: c.name })),
    ...Object.values(project.assets).filter((a) => a.kind === 'costume').map((a) => ({ id: a.id, name: a.name })),
  ]

  return (
    <>
      {ids.map((cid, i) => {
        const last = i === ids.length - 1
        const cName = costumeName(cid)
        const others = swapPool.filter((c) => c.id === cid || !attached.has(c.id)).filter((c) => c.id !== cid)
        return (
          <div key={cid} className={[s.row, s.lookRow].join(' ')} onMouseEnter={onEnter} onMouseLeave={onLeave}>
            <span />
            <div className={s.lookNameCell}>
              <span className={[s.rail, last ? s.railLast : ''].join(' ')} />
              <span className={s.lookName}>{cand.name} · {cName}</span>
            </div>
            <PromptCell
              title={`${cand.name} · ${cName}`}
              text={cand.lookPrompts?.[cid] ?? ''}
              editable={!committed}
              onSave={(v) => setCandidateLookPrompt(cand.tempId, cid, v)}
              onComplete={committed ? undefined : () => completeCandidateLookPrompt(cand.tempId, cid)}
            />
            <span className={s.stPending}>待入库</span>
            <div className={s.ops}>
              {!committed && (
                <>
                  <select
                    className={s.lookSwap}
                    value=""
                    title="换服装"
                    onChange={(e) => { if (e.target.value) swapCandidateCostume(cand.tempId, cid, e.target.value) }}
                  >
                    <option value="" disabled>⇄</option>
                    {others.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <button
                    className={s.iconBtn}
                    title="解除这套造型"
                    onClick={() => detachCandidateCostume(cand.tempId, cid)}
                  >
                    🗑
                  </button>
                </>
              )}
            </div>
          </div>
        )
      })}
    </>
  )
}

// ＋服装的下拉：选一件已有服装，或输入新名字新建（新建的服装同时出现在服装 tab）。
function CostumePicker({
  pool, onPick, onCreate, onClose,
}: {
  pool: { id: string; name: string }[]
  onPick: (id: string) => void
  onCreate: (name: string) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  return (
    <div className={s.pickerPop} onMouseLeave={onClose}>
      {pool.length > 0 && (
        <div className={s.pickerList}>
          {pool.map((c) => (
            <button key={c.id} className={s.pickerItem} onClick={() => onPick(c.id)}>{c.name}</button>
          ))}
        </div>
      )}
      <div className={s.pickerNew}>
        <input
          className={s.pickerInput}
          placeholder="新建服装…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) onCreate(name.trim()) }}
        />
        <button className={s.pickerAdd} disabled={!name.trim()} onClick={() => onCreate(name.trim())}>新建</button>
      </div>
    </div>
  )
}

// 名字：双击进入编辑，回车保存，Esc 取消（§3.5，无铅笔、无类型标签）。
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
    <span className={s.name} title="双击改名" onDoubleClick={() => { setV(name); setEditing(true) }}>
      {name}
    </span>
  )
}

// 新增资产小弹窗（§3.4）：只填名字 + 重名拦截 + 提示先补全。统一叫「新增」，不叫「补录」。
function NewAssetDialog({ kind, onClose }: { kind: AssetKind; onClose: () => void }) {
  const candidates = useStore((st) => st.candidates)
  const project = useStore((st) => st.project)
  const addManualCandidate = useStore((st) => st.addManualCandidate)
  const setTab = useStore((st) => st.setTab)
  const [name, setName] = useState('')
  const trimmed = name.trim()

  const dup =
    !!trimmed &&
    (candidates.some((c) => c.kind === kind && normalize(c.name) === normalize(trimmed)) ||
      Object.values(project.assets).some((a) => a.kind === kind && normalize(a.name) === normalize(trimmed)))

  const submit = () => {
    if (!trimmed || dup) return
    addManualCandidate(kind, trimmed)
    setTab(kind as Tab)
    onClose()
  }

  return (
    <div className={s.newOverlay} onClick={onClose}>
      <div className={s.newDialog} onClick={(e) => e.stopPropagation()}>
        <div className={s.newTitle}>新增{KIND_LABEL[kind]}</div>
        <input
          className={s.newInput}
          autoFocus
          placeholder={`${KIND_LABEL[kind]}名称`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
        />
        {dup ? (
          <div className={s.newWarn}>已存在同名{KIND_LABEL[kind]}「{trimmed}」，名称不能重复。</div>
        ) : (
          <div className={s.newHint}>先只填名字，加进来之后点「✦ AI 结合剧本补全」生成提示词。</div>
        )}
        <div className={s.newActions}>
          <button className={ui.btn} onClick={onClose}>取消</button>
          <button className={[ui.btn, ui.btnPrimary].join(' ')} disabled={!trimmed || dup} onClick={submit}>
            新增
          </button>
        </div>
      </div>
    </div>
  )
}
