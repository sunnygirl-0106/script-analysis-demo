import { Fragment, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useStore, type Tab } from '../store/useStore'
import type { Asset, AssetKind, CandidateAsset } from '../data/types'
import { KIND_DOT, KIND_LABEL } from '../components/entity'
import { ic } from '../components/icons'
import type { Decision } from '../components/decision'
import { compileTerms, type Matcher } from '../services/mentions'
import { refState } from '../services/reference'
import { lookName, looksOfCharacter } from '../services/looks'
import { PanelResizer } from '../components/PanelResizer'
import { CandidatePromptDialog } from '../components/CandidatePromptDialog'
import { SplitDensityDialog } from '../components/SplitDensityDialog'
import { FlowButton } from '../components/FlowButton'
import { Dialog } from '../components/Dialog'
import ui from '../styles/ui.module.css'
import d from '../styles/dialog.module.css'
import m from '../styles/menu.module.css'
import s from './AssetConfirm.module.css'

// 步骤② 确认资产清单（v2.0 + v2.3 §三 + v2.4 §四）：提取结果先落 candidates，用户确认后才入库。
// 左栏是**按集**的全剧原文——步骤② 系统只认「集」，场与镜要等步骤③ 才产生，
// 所以这里不出现「第 N 场」「共 N 场」。表格三类信息：名称 | 生成提示词 | 状态 | 操作。
//
// 已入库之后（补充剧本 → 只提取新集资产）这一页变成「轻量增量」形态：
// 老资产灰显只读，新候选的「状态」列变成三选一下拉（新增 / 使用已有 / 本次不入库）。

const KINDS: AssetKind[] = ['character', 'costume', 'location', 'prop']

const normalize = (t: string) => t.replace(/\s+/g, '').toLowerCase()

// 新增（手动/新建）的候选永远置顶（§3.4）。
const isManual = (tempId: string) => tempId.startsWith('cand_manual_')

// tab 上的类目图标：光靠一行文字，四个 tab 长得一模一样，扫不出「现在在看哪一类」。
const KIND_ICON: Record<AssetKind, ReactNode> = {
  character: ic.kindCharacter,
  costume: ic.kindCostume,
  location: ic.kindLocation,
  prop: ic.kindProp,
  look: ic.kindCharacter,
}

// 左原文栏宽度：可拖拽（§3.2），夹取在这个范围内。
// 初始左右 3 : 4——原文只是对照，清单才是这一步要动的东西，右边该更宽。
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
  matcher: Matcher<AssetKind> | null,
  hotSet: Set<string>,
): ReactNode {
  if (!matcher) return text
  return text.split(matcher.re).map((part, i) => {
    const kind = matcher.byTerm.get(part)
    if (!kind) return <Fragment key={i}>{part}</Fragment>
    const on = hotSet.has(normalize(part))
    return (
      <span
        key={i}
        className={[s.hl, on ? s.on : ''].join(' ')}
        data-term={normalize(part)}
        style={{ color: KIND_DOT[kind] }}
      >
        {part}
      </span>
    )
  })
}

function toBeats(raw: string): string[] {
  return raw.split('\n').map((l) => l.trim()).filter(Boolean)
}

// 追加集的结算路径判据（store.finishSplit 靠 pendingDecisions 是否为空分叉）。
// 三选一撤掉之后这里恒为空对象：所有候选按默认的「新增」结算。
const NO_DECISIONS: Record<string, Decision> = {}

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
  const [query, setQuery] = useState('')
  // 集筛选（默认全集）。原来这个位置是「排序」下拉——三种排序对一份十来条的清单没什么用，
  // 用户真正要问的是「这条是哪一集里的」，所以换成按集过滤。
  const [epFilter, setEpFilter] = useState<'all' | string>('all')
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

  // 高亮词表：候选名 + 已入库资产名（连同别名，都参与原文标注）。
  // 编译一次给全剧几十上百段共用——以前是每段各建一次正则。
  const matcher = useMemo(
    () =>
      compileTerms<AssetKind>(
        [
          ...candidates.map((c) => ({ name: c.name, kind: c.kind, aliases: c.aliases })),
          ...Object.values(project.assets).map((a) => ({ name: a.name, kind: a.kind, aliases: a.aliases })),
        ].flatMap((t) => [t.name, ...(t.aliases ?? [])].map((term) => [term, t.kind] as const)),
      ),
    [candidates, project.assets],
  )

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

  // 集筛选：阶段② 还没有场和镜，一条资产「属于哪一集」只能回到原文里问——
  // 名字或别名在那一集正文里出现过，就算它出现在这一集。这跟左栏的高亮是同一套判据。
  const scopeText = epFilter === 'all' ? null : (project.episodes.find((e) => e.id === epFilter)?.rawText ?? '')
  const inScope = (names: (string | undefined)[]) =>
    scopeText == null || names.some((n) => !!n && scopeText.includes(n))

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

  // 排序不再给用户选：手动新增置顶，其余按出现次数降序——重要的先看到，这是唯一有意义的默认。
  const sortCands = (list: CandidateAsset[]) =>
    [...list].sort((a, b) => {
      const ma = isManual(a.tempId), mb = isManual(b.tempId)
      if (ma !== mb) return ma ? -1 : 1
      return (b.occCount ?? 0) - (a.occCount ?? 0)
    })
  const sortAssets = (list: Asset[]) =>
    [...list].sort((a, b) => (usageIndex[b.id]?.shotCount ?? 0) - (usageIndex[a.id]?.shotCount ?? 0))

  const visibleCands = sortCands(candOf(kind).filter(candMatches).filter((c) => inScope([c.name, ...(c.aliases ?? [])])))
  const visibleAssets = sortAssets(committedOf(kind).filter(assetMatches).filter((a) => inScope([a.name, ...(a.aliases ?? [])])))

  return (
    <div className={s.page} ref={containerRef}>
      {/* 左：全剧原文（可拖拽调宽，§3.2；初始各占一半，§四） */}
      <div className={s.scriptCol} style={{ width: scriptW }}>
        <div className={s.scriptHead}>
          全剧原文
          <span className={s.scriptMeta}>共 {project.episodes.length} 集</span>
        </div>
        <div className={[s.scriptBody, hoverAssetTerm ? s.hovering : ''].join(' ')}>
          {project.episodes.map((ep) => (
            <div key={ep.id} className={s.sceneBlock}>
              <div className={s.epMast}>
                {/* 集头只报「第 N 集」：AI 起的那个标题在这一步没有用处，
                    跟步骤① 的集头保持同一口径。 */}
                <div className={s.epTitle}>第 {ep.no} 集</div>
              </div>
              {toBeats(ep.rawText).map((line, i) => (
                <p key={i} className={s.beat}>{highlight(line, matcher, hotSet)}</p>
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
        {/* 一条顶栏（v2.10）：左边四个类目 tab，右边「搜索 / 全集 / ＋新增」。
            原来它们分占上下两条，中间还压一道分隔线——上一条说「在看哪一类」，
            下一条说「看这一类里的哪些」，说的是同一件事的两半，没必要用掉两行高度和两道线。
            右边一组按「先筛后做」排，动作压在整行的末端。 */}
        <div className={s.tabs}>
          <div className={s.tabList}>
            {tabs.map((t) => (
              <button
                key={t.key}
                className={[s.tab, activeTab === t.key ? s.tabOn : ''].join(' ')}
                onClick={() => setTab(t.key)}
              >
                <span className={s.tabIcon}>{KIND_ICON[t.key as AssetKind]}</span>
                {t.label}
                <i className={s.tabN}>{t.n}</i>
              </button>
            ))}
          </div>
          <span className={s.toolSpacer} />
          <div className={s.search}>
            <span className={s.searchIcon}>{ic.search}</span>
            <input
              className={s.searchInput}
              placeholder="搜索名称或提示词"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            className={s.epSel}
            value={epFilter}
            onChange={(e) => setEpFilter(e.target.value)}
            title="只看某一集里出现的资产"
          >
            <option value="all">全集</option>
            {project.episodes.map((e) => (
              <option key={e.id} value={e.id}>第 {e.no} 集</option>
            ))}
          </select>
          {!committed && (
            <button className={s.addBtn} onClick={() => setNewOpen(true)}>
              {ic.add} 新增{KIND_LABEL[kind]}
            </button>
          )}
        </div>

        <div className={s.listScroll}>
          {/* 待入库候选 */}
          {visibleCands.map((c) => (
            <CandidateGroup
              key={c.tempId}
              cand={c}
              onEnter={() => enter([c.name, ...(c.aliases ?? [])])}
              onLeave={leave}
              onRename={(v) => renameCandidate(c.tempId, v)}
              onRemove={() => removeCandidate(c.tempId)}
            />
          ))}

          {/* 已入库条目：只读。不压暗整行，只在名字后面挂一枚锁（见 .lockMark 注释）。
              角色照样带出它的造型子行——造型是角色的一部分，不因为已经入过库就不该看见了。 */}
          {visibleAssets.map((a) => {
            const names = [a.name, ...(a.aliases ?? [])]
            const looks = a.kind === 'character' ? looksOfCharacter(a.id, project.assets) : []
            return (
              <Fragment key={a.id}>
                <div
                  className={[s.row, s.rowLocked].join(' ')}
                  onMouseEnter={() => enter(names)}
                  onMouseLeave={leave}
                >
                  <div className={s.mainCell}>
                    <div className={s.nameLine}>
                      <span className={s.name}>{a.name}</span>
                      <span className={s.lockMark} title="已入库，只读。改动的唯一入口是项目资产库">
                        {ic.lock}
                      </span>
                      {a.kind === 'character' && <LooksCount n={looks.length} />}
                    </div>
                    <PromptCell title={a.name} text={a.imagePrompt} editable={false} onSave={() => {}} />
                  </div>
                  <div className={s.ops}>
                    <button className={s.iconBtn} disabled title="删除只有项目资产库一个出口">
                      {ic.trash}
                    </button>
                  </div>
                  <CommittedStatus assetId={a.id} />
                </div>
                {looks.map((lk) => {
                  const label = lookName(lk, project.assets)
                  return (
                    <div
                      key={lk.id}
                      className={[s.row, s.lookRow].join(' ')}
                      onMouseEnter={() => enter(names)}
                      onMouseLeave={leave}
                    >
                      <div className={s.lookNameCell}>
                        <div className={s.lookMain}>
                          <span className={s.lookName}>{label}</span>
                          <PromptCell title={label} text={lk.imagePrompt} editable={false} onSave={() => {}} />
                        </div>
                      </div>
                      {/* 操作列留空占位：造型的解除入口只在候选态有，已入库的绑定永久只读（决策 1b）。 */}
                      <div className={s.ops} />
                      <CommittedStatus assetId={lk.id} />
                    </div>
                  )
                })}
              </Fragment>
            )
          })}

          {visibleCands.length + visibleAssets.length === 0 && (
            <div className={s.empty}>
              {q ? '没有匹配的资产' : epFilter !== 'all' ? '这一集里没有本类目的资产' : '本类目暂无候选'}
            </div>
          )}
        </div>

        {/* 页脚（v2.5 §6.1 / v2.7 §3.3）：只剩右对齐的一个主按钮。
            左边那串「N 项待入库 · 角色 3 / 服装 3…」删了——四个 tab 上各自的计数已经在说同一件事。
            没有「← 返回整理剧本」—— 要回去点步骤条 ①，那才是导航该待的地方。
            主按钮不带价：价在节奏弹窗里选完档位才是确定值。

            已入库、又没有新候选时整条不渲染（跟步骤① 的页脚同一条规矩）：
            那时这一页是回来查看资产的，没有「新增资产」可确认，
            留一颗「确认新增资产并开始拆分」在那儿只会让人以为还有什么没做完。 */}
        {candidates.length > 0 && (
          <div className={s.foot}>
            <span className={s.footSpacer} />
            <FlowButton onClick={() => setDensityOpen(true)}>
              {committed ? '确认新增资产并开始拆分' : '确认资产并开始拆分'}
            </FlowButton>
          </div>
        )}
      </div>

      {newOpen && <NewAssetDialog kind={kind} onClose={() => setNewOpen(false)} />}
      {densityOpen && (
        <SplitDensityDialog
          decisions={committed ? NO_DECISIONS : undefined}
          onClose={() => setDensityOpen(false)}
        />
      )}
    </div>
  )
}

// 提示词单元格（§3.4）：预览，点击弹浮层编辑；底下的数据行完全不动。
// 只有一种形态（v2.9 §1）：不管主条目还是造型子行，提示词都挂在名字**底下**，两行 clamp。
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
      <button
        className={s.promptCell}
        onClick={() => setOpen(true)}
        title="点击查看 / 编辑提示词"
      >
        {trimmed ? (
          <span className={s.promptPreview}>{trimmed}</span>
        ) : editable ? (
          <span className={s.promptAdd}>{ic.spark} 点击补全提示词</span>
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
// 候选行只有一种形态，首次导入与追加集完全一样：状态列恒为「待确认」，内容一律可编辑。
// 已入库之后曾经在这一列换出一个「新增到资产库 / 使用已有资产 / 本次不入库」三选一——撤了：
// AI 拆出来什么就是什么，同名的在抽取时就已经被判重滤掉了，剩下的本来就都是要入库的新资产，
// 再让用户对每一条表一次态，是把一个系统已经知道答案的问题摊给了用户。
// 灰显只读的是已经入过库的老资产，不是这一批新候选。
function CandidateGroup({
  cand, onEnter, onLeave, onRename, onRemove,
}: {
  cand: CandidateAsset
  onEnter: () => void
  onLeave: () => void
  onRename: (v: string) => void
  onRemove: () => void
}) {
  // 造型常展开（v2.10）：一个角色配了几套造型、每套的提示词写了什么，
  // 是这一步要确认的正事，不该藏在一次点击后面。折叠开关因此整个撤了——
  // 默认就是展开，那枚 ⌄ 除了给人一次「点开才看得到」的错觉，不做别的事。
  const isChar = cand.kind === 'character'
  // 组内 hover：主行和它底下的造型子行共用一个状态，鼠标在这一组里的任何一行，
  // 名字后面的「＋ 造型」就现形。子行的高亮回调本来就已经接到这一组了，顺着用。
  const [hot, setHot] = useState(false)
  const enter = () => { setHot(true); onEnter() }
  const leave = () => { setHot(false); onLeave() }
  return (
    <>
      <div
        className={s.row}
        onMouseEnter={enter}
        onMouseLeave={leave}
      >
        {/* 名字与提示词竖着叠（v2.9 §1）：提示词是几十上百字的一段话，
            塞进与名字并排的一格里，既截得难看，又把名字挤成了细细一条。 */}
        <div className={s.mainCell}>
          <div className={s.nameLine}>
            <EditableName name={cand.name} editable onCommit={onRename} />
            {isChar && <LooksCount n={(cand.costumeIds ?? []).length} />}
            {/* 「＋ 造型」跟在计数标签后面（v2.10）：它原来独占一条子行，
                每个角色白搭一行高度，且那一行永远是空的三格 + 一个按钮。
                挂到名字这一行、悬浮这一组才现形，跟操作列的垃圾桶是同一套「用时才出现」。 */}
            {isChar && <AddLookButton cand={cand} visible={hot} />}
          </div>
          <CandidateMainPrompt cand={cand} committed={false} />
        </div>
        {/* 操作列在状态列**前面**（v2.10）：状态是这一行的结论，该压在最右端收尾；
            垃圾桶平时是藏着的，放在结论左边不抢位置，鼠标到了才现形。 */}
        <div className={s.ops}>
          <button className={s.iconBtn} title="移除此候选" onClick={onRemove}>{ic.trash}</button>
        </div>
        <span className={s.stPending}>待确认</span>
      </div>
      {isChar && (
        <CandidateLookRows cand={cand} committed={false} onEnter={enter} onLeave={leave} />
      )}
    </>
  )
}

// 已入库条目的「状态」列：主行与造型子行共用。
// 「未引用」是这一页少数几个真话之一 —— 资产还在库里，只是当前剧本没有任何镜头挂着它。
function CommittedStatus({ assetId }: { assetId: string }) {
  const usageIndex = useStore((st) => st.usageIndex())
  if ((usageIndex[assetId]?.shotCount ?? 0) > 0) return <span className={s.stSaved}>已入库</span>
  return (
    <span className={s.stUnref} title="仍在项目资产库，只是当前剧本没有镜头引用它">
      {refState(usageIndex, assetId) === 'unreferenced' ? '未引用' : '已入库'}
    </span>
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

// 角色名后面的造型计数（v2.10）：`造型 ×2`。候选行与已入库行共用一个。
// 试过两版都不对：紫底胶囊长得像颗点不动的按钮；「细竖线 + 数字 + 套造型」又太素，
// 一行里多出一道竖线，反而像分栏线。这一版换成计量式写法——
// 「造型」是小灰字的量词头，`×` 压到最淡，数字用衬线体带角色紫，重量全落在数上。
// 不带底、不带框、不带线：它只是名字后面的一个计量，不假装自己是控件。
function LooksCount({ n }: { n: number }) {
  return (
    <span className={s.looksCount}>
      造型<i className={s.looksX}>×</i>
      <b className={s.looksNum}>{n}</b>
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
  const setCandidateLookPrompt = useStore((st) => st.setCandidateLookPrompt)
  const completeCandidateLookPrompt = useStore((st) => st.completeCandidateLookPrompt)
  const ids = cand.costumeIds ?? []

  const costumeName = (id: string) =>
    candidates.find((c) => c.tempId === id)?.name ?? project.assets[id]?.name ?? id

  return (
    <>
      {ids.map((cid) => {
        const cName = costumeName(cid)
        return (
          <div key={cid} className={[s.row, s.lookRow].join(' ')} onMouseEnter={onEnter} onMouseLeave={onLeave}>
            {/* 子行是并排的一条（v2.10）：造型名在左定宽，提示词接着往右占满余下宽度。
                主行才竖排——主行的名字大、提示词要摊两行；子行只是一套造型的一句话，
                横着一条更省纵向空间，几套造型的提示词起点也对齐成一条竖线。
                不缩进、不带连接轨：造型名起排跟角色名对齐，归属靠底色和字号说。 */}
            <div className={s.lookNameCell}>
              <div className={s.lookMain}>
                <span className={s.lookName}>{cand.name} · {cName}</span>
                <PromptCell
                  title={`${cand.name} · ${cName}`}
                  text={cand.lookPrompts?.[cid] ?? ''}
                  editable={!committed}
                  onSave={(v) => setCandidateLookPrompt(cand.tempId, cid, v)}
                  onComplete={committed ? undefined : () => completeCandidateLookPrompt(cand.tempId, cid)}
                />
              </div>
            </div>
            <div className={s.ops}>
              {/* 没有 ⇄ 换服装（v2.7 §3.4）：换 = 解除 + 再挂一套，两步都在这条子行上。 */}
              {!committed && (
                <button
                  className={s.iconBtn}
                  title="解除这套造型"
                  onClick={() => detachCandidateCostume(cand.tempId, cid)}
                >
                  {ic.trash}
                </button>
              )}
            </div>
            <span className={s.stPending}>待确认</span>
          </div>
        )
      })}
    </>
  )
}

// 「＋ 造型」（v2.10）：挂在角色名那一行，悬浮这一组才现形。
// 它以前是造型子行末尾独占的一整条——造型改成常展开之后，每个角色都要为它白搭一行；
// 而这个动作说的是「给**这个角色**再加一套」，本来就该待在角色名边上。
function AddLookButton({ cand, visible }: { cand: CandidateAsset; visible: boolean }) {
  const project = useStore((st) => st.project)
  const candidates = useStore((st) => st.candidates)
  const attachCandidateCostume = useStore((st) => st.attachCandidateCostume)
  const [picking, setPicking] = useState(false)

  // 可选服装：本批 costume 候选 + 已入库 costume，去掉本角色已挂的（v2.7 §3.4：只选，不建）。
  const attached = new Set(cand.costumeIds ?? [])
  const pool = [
    ...candidates.filter((c) => c.kind === 'costume').map((c) => ({ id: c.tempId, name: c.name })),
    ...Object.values(project.assets).filter((a) => a.kind === 'costume').map((a) => ({ id: a.id, name: a.name })),
  ].filter((c) => !attached.has(c.id))

  return (
    <span className={s.addLookWrap}>
      {/* 下拉开着的时候强制可见：否则鼠标一挪到弹层上就离开了这一组，按钮连同弹层一起消失。 */}
      <button
        className={[s.addLook, visible || picking ? s.addLookOn : ''].join(' ')}
        onClick={() => setPicking((v) => !v)}
      >
        {ic.add} 造型
      </button>
      {picking && (
        <CostumePicker
          pool={pool}
          onPick={(id) => { attachCandidateCostume(cand.tempId, id); setPicking(false) }}
          onClose={() => setPicking(false)}
        />
      )}
    </span>
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
            <button key={c.id} className={m.item} onClick={() => onPick(c.id)}>{c.name}</button>
          ))}
        </div>
      )}
      {pool.length > 0 && <div className={m.sep} />}
      <button className={m.exit} onClick={() => { setTab('costume'); onClose() }}>
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

  const label = KIND_LABEL[kind]

  return (
    <Dialog onClose={onClose} className={s.newDialog}>
      <div className={d.title}>新增{label}</div>
      <div className={d.desc}>先填名字，提示词稍后可以再补。</div>
      <div className={d.field}>
        <div className={d.label}>{label}名</div>
        <input
          className={[d.input, dup ? d.inputErr : ''].join(' ')}
          autoFocus
          placeholder={`例如：${NEW_ASSET_EG[kind]}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
        />
        {dup && <div className={d.errText}>已有同名{label}，换一个名字。</div>}
      </div>
      <div className={d.actions}>
        <button className={ui.btn} onClick={onClose}>取消</button>
        <button className={[ui.btn, ui.btnPrimary].join(' ')} disabled={!trimmed || dup} onClick={submit}>
          添加
        </button>
      </div>
    </Dialog>
  )
}

/** 占位符里的举例。四类各给一个，比「角色名称」这种同义反复更能说明该填什么。 */
const NEW_ASSET_EG: Record<AssetKind, string> = {
  character: '外卖员',
  costume: '外卖工装',
  location: '楼道',
  prop: '外卖箱',
  look: '外卖员 · 工装',
}
