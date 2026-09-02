import { Fragment, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useStore, type Tab } from '../store/useStore'
import type { Asset, AssetKind, CandidateAsset, CandidateDecision } from '../data/types'
import { KIND_DOT, KIND_LABEL } from '../components/entity'
import { DECISION_META, type Decision } from '../components/decision'
import { refState } from '../services/reference'
import { PanelResizer } from '../components/PanelResizer'
import { CandidatePromptDialog } from '../components/CandidatePromptDialog'
import { SplitDensityDialog } from '../components/SplitDensityDialog'
import ui from '../styles/ui.module.css'
import s from './AssetConfirm.module.css'

// 步骤② 确认资产清单（v2.0 + v2.3 §三 + v2.4 §四）：提取结果先落 candidates，用户确认后才入库。
// 左栏是**按集**的全剧原文——步骤② 系统只认「集」，场与镜要等步骤③ 才产生，
// 所以这里不出现「第 N 场」「共 N 场」。表格三类信息：名称 | 生成提示词 | 状态 | 操作。
//
// 已入库之后（补充剧本 → 只提取新集资产）这一页变成「轻量增量」形态：
// 老资产灰显只读，新候选的「状态」列变成三选一下拉（新增 / 使用已有 / 本次不入库）。

const KINDS: AssetKind[] = ['character', 'costume', 'location', 'prop']

const normalize = (t: string) => t.replace(/\s+/g, '').toLowerCase()

type SortKey = 'occ' | 'first' | 'name'
const SORT_LABEL: Record<SortKey, string> = { occ: '按出现次数', first: '按首次出现', name: '按名称' }
// 新增（手动/新建）的候选永远置顶，排序只在同组内生效（§3.4）。
const isManual = (tempId: string) => tempId.startsWith('cand_manual_')

// 左原文栏宽度：可拖拽（§3.2），夹取在这个范围内。
// v2.7 §3.1：初始左右 3 : 4——原文只是对照，清单才是这一步要动的东西，右边该更宽。
const SCRIPT_MIN = 380
const SCRIPT_MAX = 820

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

  const kind: AssetKind = (KINDS as string[]).includes(activeTab) ? (activeTab as AssetKind) : 'character'
  const [newOpen, setNewOpen] = useState(false)
  // 已入库时每条新候选的处理方式；点主按钮时一次性交给 confirmIncremental 结算。
  const [decisions, setDecisions] = useState<Record<string, Decision>>({})
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('occ')
  const [scriptW, setScriptW] = useState(460)
  // 挂载时量一次内容区宽度，把左栏摆成 3 : 4（v2.7 §3.1）。之后由拖拽接管，不再自动改。
  const containerRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const w = containerRef.current?.clientWidth
    if (w) setScriptW(Math.round(Math.min(SCRIPT_MAX, Math.max(SCRIPT_MIN, (w * 3) / 7))))
  }, [])
  // 主按钮不带价：价要等节奏选完才知道，所以它只负责打开节奏弹窗（v2.5 §6.1）。
  const [densityOpen, setDensityOpen] = useState(false)

  const candOf = (k: AssetKind) => candidates.filter((c) => c.kind === k)
  const committedOf = (k: AssetKind) => Object.values(project.assets).filter((a) => a.kind === k)

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

  // 全剧原文：按集连读。原文没有任何结构标记（v2.6 §二），一行一段直接铺开。

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
    <div className={s.page} ref={containerRef}>
      {/* 左：全剧原文（可拖拽调宽，§3.2；初始各占一半，§四） */}
      <div className={s.scriptCol} style={{ width: scriptW }}>
        <div className={s.scriptHead}>
          全剧原文
          <span className={s.scriptMeta}>
            共 {project.episodes.length} 集 · 场与镜头在第 ③ 步产生
          </span>
        </div>
        <div className={[s.scriptBody, hoverAssetTerm ? s.hovering : ''].join(' ')}>
          {project.episodes.map((ep) => (
            <div key={ep.id} className={s.sceneBlock}>
              <div className={s.epMast}>
                <div className={s.epEyebrow}>EPISODE {String(ep.no).padStart(2, '0')}</div>
                <div className={s.epTitle}>第 {ep.no} 集 · {ep.title}</div>
              </div>
              {toBeats(ep.rawText).map((line, i) => (
                <p key={i} className={s.beat}>{highlight(line, terms, hotSet)}</p>
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
          <div className={[s.colHead, committed ? s.gridDecide : ''].join(' ')}>
            <span />
            <span>名称</span>
            <span>生成提示词</span>
            <span>{committed ? '处理方式' : '状态'}</span>
            <span>操作</span>
          </div>

          {/* 待入库候选 */}
          {visibleCands.map((c) => (
            <CandidateGroup
              key={c.tempId}
              cand={c}
              committed={committed}
              assets={project.assets}
              decision={decisions[c.tempId]}
              onDecide={(dec, link) =>
                setDecisions((m) => ({ ...m, [c.tempId]: { decision: dec, linkTargetId: link } }))
              }
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
                className={[s.row, s.rowLocked, committed ? s.gridDecide : ''].join(' ')}
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

        {/* 页脚（v2.5 §6.1 / v2.7 §3.3）：只剩右对齐的一个主按钮。
            左边那串「N 项待入库 · 角色 3 / 服装 3…」删了——四个 tab 上各自的计数已经在说同一件事。
            没有「← 返回整理剧本」—— 要回去点步骤条 ①，那才是导航该待的地方。
            主按钮不带价：价在节奏弹窗里选完档位才是确定值。 */}
        <div className={s.foot}>
          <span className={s.footSpacer} />
          <button
            className={[ui.btn, ui.btnPrimary].join(' ')}
            onClick={() => setDensityOpen(true)}
          >
            {committed ? '确认新增资产并开始拆分' : '确认资产并开始拆分'}
          </button>
        </div>
      </div>

      {newOpen && <NewAssetDialog kind={kind} onClose={() => setNewOpen(false)} />}
      {densityOpen && (
        <SplitDensityDialog
          decisions={committed ? decisions : undefined}
          onClose={() => setDensityOpen(false)}
        />
      )}
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
// committed 只切换「状态」列的形态（待入库 ↔ 三选一下拉）——候选本身在两种形态下都可编辑，
// 灰显只读的是已经入过库的老资产，不是这一批新候选。
function CandidateGroup({
  cand, committed, assets, decision, onDecide, onEnter, onLeave, onRename, onRemove,
}: {
  cand: CandidateAsset
  committed: boolean
  assets: Record<string, Asset>
  decision?: Decision
  onDecide: (decision: CandidateDecision, linkTargetId?: string) => void
  onEnter: () => void
  onLeave: () => void
  onRename: (v: string) => void
  onRemove: () => void
}) {
  const [open, setOpen] = useState(false)
  const isChar = cand.kind === 'character'
  return (
    <>
      <div
        className={[s.row, committed ? s.gridDecide : ''].join(' ')}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        <i className={s.dot} style={{ background: KIND_DOT[cand.kind] }} />
        <div className={s.nameCell}>
          <EditableName name={cand.name} editable onCommit={onRename} />
          {isChar && <CandidateLooksToggle cand={cand} open={open} setOpen={setOpen} />}
        </div>
        <CandidateMainPrompt cand={cand} committed={false} />
        {committed ? (
          <DecisionCell cand={cand} assets={assets} decision={decision} onDecide={onDecide} />
        ) : (
          <span className={s.stPending}>待入库</span>
        )}
        <div className={s.ops}>
          <button className={s.iconBtn} title="移除此候选" onClick={onRemove}>🗑</button>
        </div>
      </div>
      {isChar && open && (
        <CandidateLookRows cand={cand} committed={false} onEnter={onEnter} onLeave={onLeave} />
      )}
    </>
  )
}

// 已入库之后，候选行的「状态」列不再显示「待入库」，而是这个三选一（v2.4 §4.3）。
function DecisionCell({
  cand, assets, decision, onDecide,
}: {
  cand: CandidateAsset
  assets: Record<string, Asset>
  decision?: Decision
  onDecide: (decision: CandidateDecision, linkTargetId?: string) => void
}) {
  const d = decision ?? { decision: 'new' as CandidateDecision }
  const pool = Object.values(assets).filter((a) => a.kind === cand.kind)
  return (
    <div className={s.decideCell}>
      <select
        className={s.decideSel}
        value={d.decision}
        onChange={(e) => {
          const dec = e.target.value as CandidateDecision
          onDecide(dec, dec === 'link' ? (d.linkTargetId ?? pool[0]?.id) : undefined)
        }}
      >
        {DECISION_META.map((m) => (
          <option key={m.key} value={m.key} disabled={m.key === 'link' && pool.length === 0}>
            {m.label}
          </option>
        ))}
      </select>
      {d.decision === 'link' && (
        <select
          className={s.decideSel}
          value={d.linkTargetId ?? pool[0]?.id ?? ''}
          onChange={(e) => onDecide('link', e.target.value)}
        >
          {pool.length === 0 && <option value="">（无同类已入库资产）</option>}
          {pool.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      )}
    </div>
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

// 角色候选的造型开关（v2.7 §3.4）：只剩 `N 套造型 ⌄`。
// 原来旁边还有个「＋ 服装」，它的下拉能输名字新建——用户分不清那是在建服装还是在建造型。
// 新增造型改到展开后的子行末尾（那里上下文明确：这一条就是「这个角色的一套造型」）。
function CandidateLooksToggle({
  cand, open, setOpen,
}: { cand: CandidateAsset; open: boolean; setOpen: (v: boolean) => void }) {
  const count = (cand.costumeIds ?? []).length
  return (
    <span className={s.looksToggleWrap}>
      <button className={s.looksToggle} onClick={() => setOpen(!open)}>
        {count} 套造型 <span className={s.caret}>{open ? '⌃' : '⌄'}</span>
      </button>
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
  const attachCandidateCostume = useStore((st) => st.attachCandidateCostume)
  const detachCandidateCostume = useStore((st) => st.detachCandidateCostume)
  const setCandidateLookPrompt = useStore((st) => st.setCandidateLookPrompt)
  const completeCandidateLookPrompt = useStore((st) => st.completeCandidateLookPrompt)
  const [picking, setPicking] = useState(false)
  const ids = cand.costumeIds ?? []

  const costumeName = (id: string) =>
    candidates.find((c) => c.tempId === id)?.name ?? project.assets[id]?.name ?? id

  // 可选服装：本批 costume 候选 + 已入库 costume，去掉本角色已挂的（v2.7 §3.4：只选，不建）。
  const attached = new Set(ids)
  const pool = [
    ...candidates.filter((c) => c.kind === 'costume').map((c) => ({ id: c.tempId, name: c.name })),
    ...Object.values(project.assets).filter((a) => a.kind === 'costume').map((a) => ({ id: a.id, name: a.name })),
  ].filter((c) => !attached.has(c.id))

  return (
    <>
      {ids.map((cid) => {
        const cName = costumeName(cid)
        return (
          <div key={cid} className={[s.row, s.lookRow].join(' ')} onMouseEnter={onEnter} onMouseLeave={onLeave}>
            <span />
            <div className={s.lookNameCell}>
              <span className={s.rail} />
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
              {/* 没有 ⇄ 换服装（v2.7 §3.4）：换 = 解除 + 再挂一套，两步都在这条子行上。 */}
              {!committed && (
                <button
                  className={s.iconBtn}
                  title="解除这套造型"
                  onClick={() => detachCandidateCostume(cand.tempId, cid)}
                >
                  🗑
                </button>
              )}
            </div>
          </div>
        )
      })}
      {!committed && (
        <div className={[s.row, s.lookRow].join(' ')}>
          <span />
          <div className={s.lookNameCell}>
            <span className={[s.rail, s.railLast].join(' ')} />
            <span className={s.addLookWrap}>
              <button className={s.addLook} onClick={() => setPicking((v) => !v)}>
                ＋ 增加一套造型
              </button>
              {picking && (
                <CostumePicker
                  pool={pool}
                  onPick={(id) => { attachCandidateCostume(cand.tempId, id); setPicking(false) }}
                  onClose={() => setPicking(false)}
                />
              )}
            </span>
          </div>
          <span />
          <span />
          <span />
        </div>
      )}
    </>
  )
}

// 「＋ 增加一套造型」的下拉（v2.7 §3.4）：**只列服装 tab 里已有的服装**，不在这里新建。
// 造型 = 角色 × 服装，所以这里唯一的选择是「挑哪件服装」；真要新服装，去服装 tab 建，
// 那才是服装这条资产该被创建的地方。底部那行灰链接就是这个出口。
function CostumePicker({
  pool, onPick, onClose,
}: {
  pool: { id: string; name: string }[]
  onPick: (id: string) => void
  onClose: () => void
}) {
  const setTab = useStore((st) => st.setTab)
  return (
    <div className={s.pickerPop} onMouseLeave={onClose}>
      {pool.length > 0 && (
        <div className={s.pickerList}>
          {pool.map((c) => (
            <button key={c.id} className={s.pickerItem} onClick={() => onPick(c.id)}>{c.name}</button>
          ))}
        </div>
      )}
      <button className={s.pickerGo} onClick={() => { setTab('costume'); onClose() }}>
        没有合适的服装？去「服装」新增 →
      </button>
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
        {dup && (
          <div className={s.newWarn}>已存在同名{KIND_LABEL[kind]}「{trimmed}」，名称不能重复。</div>
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
