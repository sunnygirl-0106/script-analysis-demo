import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Dialog } from '../components/Dialog'
import { useStore } from '../store/useStore'
import { useClickOutside } from '../hooks/useClickOutside'
import { RATE, costExtract, fmtCost } from '../services/cost'
import { ScriptSourceDialog } from '../components/ScriptSourceDialog'
import ui from '../styles/ui.module.css'
import d from '../styles/dialog.module.css'
import s from './EpisodeOrganize.module.css'

// 页级 ⋯ 菜单的描边图标（沿用 EpisodeTree 里那套 15px svg 写法）。
const svg = (dPath: ReactNode) => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth={1.7}>
    {dPath}
  </svg>
)
const ic = {
  upload: svg(
    <>
      <path d="M12 16V5" strokeLinecap="round" />
      <path d="M8 8.6 12 4.6l4 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 18.5h15" strokeLinecap="round" />
    </>,
  ),
  add: svg(
    <>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </>,
  ),
  download: svg(
    <>
      <path d="M12 4v11" strokeLinecap="round" />
      <path d="M8 11.4 12 15.4l4-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 19.5h15" strokeLinecap="round" />
    </>,
  ),
}

// 步骤① 整理剧本（v2.4 §3.2 + v2.5 §五）。单栏手风琴：一个集一块，展开看正文。
//
// 这一页只认「集」这一个实体——页面上不出现「第 N 场」「共 N 场」，因为场根本还不存在，
// 它是步骤③「开始拆分」的产物。原文本身也没有任何结构标记（v2.6 §二）：用户上传的是一大段散文，
// 步骤① 只把它切成集，正文里不出现小标题、场头。
//
// 锁是集级的，不是整页的：提取过资产的集带 🔒 只读；新补充进来的集没锁，可改名 / 合并 / 删除。
// 整理剧本页本身永远可以回来看，「补充剧本」永远可用。

/** 正文渲染（v2.6 §2.1）：用户上传的就是一大段散文，没有分集分场标记。
 *  这里只保留作者自己的换行——一行一段，不认任何小标题 / 场头。 */
function EpisodeBody({ rawText }: { rawText: string }) {
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean)
  return (
    <div className={s.body}>
      {lines.map((line, i) => (
        <p key={i} className={s.para}>{line}</p>
      ))}
    </div>
  )
}

/** 手动新建集的正文录入（v2.5 §5.3）。失焦写回，一有内容就切回普通正文渲染。 */
function DraftBody({ onCommit }: { onCommit: (text: string) => void }) {
  const [text, setText] = useState('')
  return (
    <div className={s.draftBody}>
      <textarea
        className={s.draftInput}
        value={text}
        spellCheck={false}
        placeholder="粘贴或输入本集剧本内容…"
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onCommit(text)}
      />
      <div className={s.draftHint}>失焦后自动保存并统计字数。</div>
    </div>
  )
}

export function EpisodeOrganize() {
  const project = useStore((st) => st.project)
  const startExtract = useStore((st) => st.startExtract)
  const renameEpisode = useStore((st) => st.renameEpisode)
  const deleteDraftEpisode = useStore((st) => st.deleteDraftEpisode)
  const mergeEpisodeUp = useStore((st) => st.mergeEpisodeUp)
  const createBlankEpisode = useStore((st) => st.createBlankEpisode)
  const setEpisodeText = useStore((st) => st.setEpisodeText)
  const showToast = useStore((st) => st.showToast)

  const episodes = project.episodes
  const committed = project.libraryCommittedAt != null
  const hasEp2 = episodes.some((e) => e.id === 'e2')

  const [open, setOpen] = useState<string[]>(() => (episodes[0] ? [episodes[0].id] : []))
  const [pageMenu, setPageMenu] = useState(false)
  const [epMenu, setEpMenu] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [supplementOpen, setSupplementOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const pageMenuRef = useRef<HTMLDivElement>(null)
  useClickOutside(pageMenuRef, () => setPageMenu(false), pageMenu)
  const epMenuRef = useRef<HTMLDivElement>(null)
  useClickOutside(epMenuRef, () => setEpMenu(null), epMenu !== null)

  // 补充进来的新集自动展开并滚到视野内——否则它落在列表末尾，用户看不见自己刚做的事。
  const seen = useRef(new Set(episodes.map((e) => e.id)))
  useEffect(() => {
    const fresh = episodes.find((e) => !seen.current.has(e.id))
    episodes.forEach((e) => seen.current.add(e.id))
    if (!fresh) return
    setOpen((o) => (o.includes(fresh.id) ? o : [...o, fresh.id]))
    window.setTimeout(() => {
      document.getElementById(`ep-${fresh.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 60)
  }, [episodes])

  const toggle = (id: string) =>
    setOpen((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]))

  const commitRename = () => {
    if (editing) renameEpisode(editing, draft)
    setEditing(null)
  }

  const totalWords = episodes.reduce((n, e) => n + e.wordCount, 0)
  const drafts = episodes.filter((e) => !e.extractedAt)
  const draftWords = drafts.reduce((n, e) => n + e.wordCount, 0)
  const extractCost = costExtract(draftWords)

  // 异常提示只做两条真实规则：集号断档、某集过短。没有异常就不渲染，
  // 不写「✓ 未发现异常」——一条永远为真的提示只会训练用户忽略这一行。
  const anomalies: string[] = []
  const gap = episodes.find((e, i) => i > 0 && e.no !== episodes[i - 1]!.no + 1)
  if (gap) anomalies.push(`集号不连续：第 ${gap.no} 集前有断档，请确认是否漏传。`)
  for (const e of episodes) {
    // 手动新建、还一个字没输的集，说的是「没内容」而不是「没切干净」——这是两件事。
    if (e.wordCount === 0) anomalies.push(`第 ${e.no} 集还没有内容。`)
    else if (e.wordCount < 500) anomalies.push(`第 ${e.no} 集只有 ${e.wordCount.toLocaleString()} 字，可能没切干净。`)
  }

  const del = confirmDelete ? episodes.find((e) => e.id === confirmDelete) : undefined

  return (
    <div className={s.page}>
      <div className={s.wrap}>
        <div className={s.headInner}>
          <div className={s.headTitle}>共 {episodes.length} 集</div>
          <div className={s.menuWrap} ref={pageMenuRef}>
            <button className={s.dots} title="更多操作" onClick={() => setPageMenu((v) => !v)}>⋯</button>
            {/* 没有「重新上传剧本」（v2.5 §2.5）：换剧本 = 新建项目，演示里走顶栏「▶ 重新演示」。 */}
            {pageMenu && (
              <div className={s.menu}>
                <button
                  className={s.menuItem}
                  disabled={hasEp2}
                  title={hasEp2 ? '当前演示只有一份续集数据，已解析过' : undefined}
                  onClick={() => { setPageMenu(false); setSupplementOpen(true) }}
                >
                  <span className={s.menuIcon}>{ic.upload}</span>
                  上传文件 · 解析新集
                </button>
                <button
                  className={s.menuItem}
                  onClick={() => { setPageMenu(false); createBlankEpisode() }}
                >
                  <span className={s.menuIcon}>{ic.add}</span>
                  新建一集
                </button>
                <button
                  className={s.menuItem}
                  onClick={() => { setPageMenu(false); showToast('已导出剧本（示例，不落盘）') }}
                >
                  <span className={s.menuIcon}>{ic.download}</span>
                  下载剧本
                </button>
              </div>
            )}
          </div>
        </div>
        <div className={s.headSub}>
          当前已整理 {episodes.length} 集 · {totalWords.toLocaleString()} 字
        </div>

        {anomalies.length > 0 && (
          <div className={s.anomaly}>
            {anomalies.map((a, i) => (
              <div key={i} className={s.anomalyLine}>⚠ {a}</div>
            ))}
          </div>
        )}

        <div className={s.card}>
          {episodes.map((ep, i) => {
            const expanded = open.includes(ep.id)
            const locked = ep.extractedAt != null
            return (
              <div className={s.epBlock} key={ep.id} id={`ep-${ep.id}`}>
                <div className={s.epHead}>
                  <button className={s.caret} onClick={() => toggle(ep.id)} title={expanded ? '收起' : '展开'}>
                    {expanded ? '▾' : '▸'}
                  </button>
                  <span className={s.epNo}>第 {ep.no} 集</span>
                  {editing === ep.id ? (
                    <input
                      className={s.epInput}
                      value={draft}
                      autoFocus
                      spellCheck={false}
                      onChange={(e) => setDraft(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename()
                        else if (e.key === 'Escape') setEditing(null)
                      }}
                    />
                  ) : (
                    <button className={s.epTitle} onClick={() => toggle(ep.id)}>{ep.title}</button>
                  )}
                  {locked ? (
                    <span className={s.lock} title="已提取资产，不可再改">🔒</span>
                  ) : (
                    <span className={s.newBadge}>未拆解</span>
                  )}
                  <span className={s.epWords}>{ep.wordCount.toLocaleString()} 字</span>
                  <div className={s.epMenuWrap} ref={epMenu === ep.id ? epMenuRef : undefined}>
                    <button
                      className={[s.epDots, epMenu === ep.id ? s.epDotsOn : ''].join(' ')}
                      title="本集操作"
                      onClick={() => setEpMenu((m) => (m === ep.id ? null : ep.id))}
                    >
                      ⋯
                    </button>
                    {epMenu === ep.id && (
                      <div className={s.menu}>
                        <button
                          className={s.menuItem}
                          onClick={() => { setEpMenu(null); setDraft(ep.title); setEditing(ep.id) }}
                        >
                          重命名
                        </button>
                        {i > 0 && (
                          <button
                            className={s.menuItem}
                            disabled={locked}
                            title={locked ? '已提取资产，不可再改' : undefined}
                            onClick={() => { setEpMenu(null); mergeEpisodeUp(ep.id) }}
                          >
                            与上一集合并
                          </button>
                        )}
                        <button
                          className={[s.menuItem, s.menuDanger].join(' ')}
                          disabled={locked}
                          title={locked ? '已提取资产，不可再改' : undefined}
                          onClick={() => { setEpMenu(null); setConfirmDelete(ep.id) }}
                        >
                          删除本集
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {expanded &&
                  (!locked && ep.rawText === '' ? (
                    <DraftBody
                      key={ep.id}
                      onCommit={(text) => setEpisodeText(ep.id, text)}
                    />
                  ) : (
                    <EpisodeBody rawText={ep.rawText} />
                  ))}
              </div>
            )
          })}
        </div>
      </div>

      {/* 悬浮胶囊页脚（v2.6 §3.2）：只在「有草稿集等着提取」时出现。
          没有草稿就整条不渲染——这一页看完了点步骤条就行，不需要一个按钮催。 */}
      {drafts.length > 0 && (
        <div className={s.capsuleRow}>
        <div className={s.capsule}>
          <span className={s.liveDot}>●</span>
          <span className={s.capsuleText}>
            {committed
              ? `新增 ${drafts.length} 集，将只对新集提取资产`
              : '剧本内容整理完毕，将进行剧本资产拆解'}
          </span>
          <button
            className={[ui.btn, ui.btnPrimary].join(' ')}
            title={`按字数计费 · ${fmtCost(RATE.extractPerKChar)} / 千字`}
            onClick={startExtract}
          >
            资产提取 · {fmtCost(extractCost)}
          </button>
        </div>
        </div>
      )}

      {supplementOpen && (
        <ScriptSourceDialog mode="supplement" onClose={() => setSupplementOpen(false)} />
      )}

      {/* 删除本集：不可逆，走一次确认。 */}
      {del && (
        <Dialog onClose={() => setConfirmDelete(null)} className={d.dialog}>
          <div className={d.title}>删除第 {del.no} 集「{del.title}」？</div>
          <div className={d.danger}>
            这一集的 {del.wordCount.toLocaleString()} 字原文将从项目中移除，后续集号顺延。
            本集还没提取过资产，删除不影响项目资产库。此操作不可撤销。
          </div>
          <div className={d.actions}>
            <button className={ui.btn} onClick={() => setConfirmDelete(null)}>取消</button>
            <button
              className={[ui.btn, ui.btnDanger].join(' ')}
              onClick={() => { deleteDraftEpisode(del.id); setConfirmDelete(null) }}
            >
              删除
            </button>
          </div>
        </Dialog>
      )}
    </div>
  )
}
