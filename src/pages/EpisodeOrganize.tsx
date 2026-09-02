import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { useClickOutside } from '../hooks/useClickOutside'
import { RATE, costExtract, fmtCost } from '../services/cost'
import { SupplementScriptDialog } from '../components/SupplementScriptDialog'
import ui from '../styles/ui.module.css'
import d from '../components/ScriptImportDialog.module.css'
import s from './EpisodeOrganize.module.css'

// 步骤① 整理剧本（v2.4 §3.2）。单栏手风琴：一个集一块，展开看正文。
//
// 这一页只认「集」这一个实体——页面上不出现「第 N 场」「共 N 场」，因为场根本还不存在，
// 它是步骤③「开始拆分」的产物。原文里剧本作者自己写的场头（`§ 地点 · 时间`）以视觉分块保留，
// 那是排版不是数据。
//
// 锁是集级的，不是整页的：提取过资产的集带 🔒 只读；新补充进来的集没锁，可改名 / 合并 / 删除。
// 整理剧本页本身永远可以回来看，「补充剧本」永远可用。

/** 正文渲染：`§ ` 开头的行是场头，渲染成小标题；其余按行成段。 */
function EpisodeBody({ rawText }: { rawText: string }) {
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean)
  return (
    <div className={s.body}>
      {lines.map((line, i) =>
        line.startsWith('§ ') ? (
          <div key={i} className={s.sceneHead}>{line.slice(2)}</div>
        ) : (
          <p key={i} className={s.para}>{line}</p>
        ),
      )}
    </div>
  )
}

export function EpisodeOrganize() {
  const project = useStore((st) => st.project)
  const startExtract = useStore((st) => st.startExtract)
  const setAnalysisStep = useStore((st) => st.setAnalysisStep)
  const renameEpisode = useStore((st) => st.renameEpisode)
  const deleteDraftEpisode = useStore((st) => st.deleteDraftEpisode)
  const mergeEpisodeUp = useStore((st) => st.mergeEpisodeUp)
  const replayDemo = useStore((st) => st.replayDemo)

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
    if (e.wordCount < 500) anomalies.push(`第 ${e.no} 集只有 ${e.wordCount.toLocaleString()} 字，可能没切干净。`)
  }

  const del = confirmDelete ? episodes.find((e) => e.id === confirmDelete) : undefined

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div className={s.headTitle}>
          共 {episodes.length} 集 · {totalWords.toLocaleString()} 字
        </div>
        <div className={s.menuWrap} ref={pageMenuRef}>
          <button className={s.dots} title="更多操作" onClick={() => setPageMenu((v) => !v)}>⋯</button>
          {pageMenu && (
            <div className={s.menu}>
              <button
                className={s.menuItem}
                disabled={hasEp2}
                title={hasEp2 ? '当前演示只有一份续集数据，已补充过' : undefined}
                onClick={() => { setPageMenu(false); setSupplementOpen(true) }}
              >
                补充剧本
              </button>
              <button
                className={s.menuItem}
                disabled={committed}
                title={committed ? '已保存到项目资产库；换一部剧本请新建项目' : undefined}
                onClick={() => { setPageMenu(false); replayDemo() }}
              >
                重新上传剧本
              </button>
              <div className={s.menuSep} />
              <button className={s.menuItem} onClick={() => { setPageMenu(false); setOpen([]) }}>
                收起全部
              </button>
            </div>
          )}
        </div>
      </div>

      {anomalies.length > 0 && (
        <div className={s.anomaly}>
          {anomalies.map((a, i) => (
            <div key={i} className={s.anomalyLine}>⚠ {a}</div>
          ))}
        </div>
      )}

      <div className={s.listScroll}>
        <div className={s.list}>
          {episodes.map((ep, i) => {
            const expanded = open.includes(ep.id)
            const locked = ep.extractedAt != null
            return (
              <div className={s.epBlock} key={ep.id} id={`ep-${ep.id}`}>
                <div className={s.epHead}>
                  <button className={s.caret} onClick={() => toggle(ep.id)} title={expanded ? '收起' : '展开'}>
                    {expanded ? '▾' : '▸'}
                  </button>
                  <span className={s.epNo}>{ep.no}.</span>
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
                    <span className={s.newBadge}>新增</span>
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
                {expanded && <EpisodeBody rawText={ep.rawText} />}
              </div>
            )
          })}
        </div>
      </div>

      <div className={s.foot}>
        {drafts.length === 0 ? (
          <>
            <div className={s.footInfo}>
              <span className={s.okDot}>✓</span> 全部 {episodes.length} 集已提取资产
            </div>
            <button
              className={[ui.btn, ui.btnPrimary].join(' ')}
              onClick={() =>
                setAnalysisStep(Object.keys(project.shots).length > 0 ? 'storyboard' : 'assetConfirm')
              }
            >
              进入下一步 →
            </button>
          </>
        ) : (
          <>
            <div className={s.footInfo}>
              <span className={s.liveDot}>●</span>{' '}
              {committed
                ? `新增 ${drafts.length} 集待提取资产`
                : `剧本内容整理完毕 · 共 ${episodes.length} 集 · ${totalWords.toLocaleString()} 字`}
            </div>
            <div className={s.ctaWrap}>
              <button className={[ui.btn, ui.btnPrimary].join(' ')} onClick={startExtract}>
                {committed
                  ? `提取第 ${drafts.map((e) => e.no).join(' / ')} 集资产`
                  : '确认集数并提取资产'}{' '}
                · {fmtCost(extractCost)}
              </button>
              <div className={s.ctaNote}>按字数计费 · {fmtCost(RATE.extractPerKChar)} / 千字</div>
            </div>
          </>
        )}
      </div>

      {supplementOpen && <SupplementScriptDialog onClose={() => setSupplementOpen(false)} />}

      {/* 删除本集：不可逆，走一次确认。 */}
      {del && (
        <div className={d.overlay} onClick={() => setConfirmDelete(null)}>
          <div className={d.dialog} onClick={(e) => e.stopPropagation()}>
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
          </div>
        </div>
      )}
    </div>
  )
}
