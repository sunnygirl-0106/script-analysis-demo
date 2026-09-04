import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Dialog } from '../components/Dialog'
import { useStore } from '../store/useStore'
import { useClickOutside } from '../hooks/useClickOutside'
import { RATE, costExtract, fmtCost } from '../services/cost'
import { ScriptSourceDialog } from '../components/ScriptSourceDialog'
import { SUPPLEMENT_EP_ID } from '../data/seedEpisode3'
import { FlowButton } from '../components/FlowButton'
import { ic } from '../components/icons'
import ui from '../styles/ui.module.css'
import d from '../styles/dialog.module.css'
import m from '../styles/menu.module.css'
import s from './EpisodeOrganize.module.css'

// 步骤① 整理剧本（v2.4 §3.2 + v2.5 §五）。单栏手风琴：一个集一块，展开看正文、直接改正文。
//
// 这一页只认「集」这一个实体——页面上不出现「第 N 场」「共 N 场」，因为场根本还不存在，
// 它是步骤③「开始拆分」的产物。原文本身也没有任何结构标记（v2.6 §二）：用户上传的是一大段散文，
// 步骤① 只把它切成集，正文里不出现小标题、场头。
//
// 集头只报「第 N 集」：AI 起的那个标题（「外卖与尊严」）在这一步没有任何用处——
// 用户在这儿要判断的是「切得对不对、内容全不全」，一个凭空生成的名字只会挡住这个判断。
//
// 锁是集级的，不是整页的：提取过资产的集只读；没锁的集正文可改、可删。
// 整理剧本页本身永远可以回来看，「补充剧本」永远可用。

/** 本集正文。没锁 = 就地可编辑的 textarea，改一个字就写回 store（实时保存，没有保存按钮）；
 *  已锁 = 一行一段的只读散文。两态排版一致，切换时正文不跳位。 */
function EpisodeBody({ id, rawText, locked }: { id: string; rawText: string; locked: boolean }) {
  const setEpisodeText = useStore((st) => st.setEpisodeText)
  const ref = useRef<HTMLTextAreaElement>(null)

  // 高度跟着内容走：分集正文动辄几千字，内嵌滚动条会把「读一遍确认切得对不对」这件事变得很难受。
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [rawText, locked])

  if (locked) {
    const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean)
    return (
      <div className={s.body}>
        {lines.map((line, i) => (
          <p key={i} className={s.para}>{line}</p>
        ))}
      </div>
    )
  }

  return (
    <div className={s.body}>
      <textarea
        ref={ref}
        className={s.bodyInput}
        value={rawText}
        spellCheck={false}
        placeholder="粘贴或输入本集剧本内容…"
        onChange={(e) => setEpisodeText(id, e.target.value)}
      />
    </div>
  )
}

export function EpisodeOrganize() {
  const project = useStore((st) => st.project)
  const startExtract = useStore((st) => st.startExtract)
  const deleteDraftEpisode = useStore((st) => st.deleteDraftEpisode)
  const createBlankEpisode = useStore((st) => st.createBlankEpisode)
  const showToast = useStore((st) => st.showToast)

  const episodes = project.episodes
  const committed = project.libraryCommittedAt != null
  const hasSupplement = episodes.some((e) => e.id === SUPPLEMENT_EP_ID)

  // 默认全部展开：这一页要判断的是「切得对不对、内容全不全」，折起来就得挨个点开才看得见。
  const [open, setOpen] = useState<string[]>(() => episodes.map((e) => e.id))
  const [pageMenu, setPageMenu] = useState(false)
  const [supplementOpen, setSupplementOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  // 进资产提取前的确认：这一步要花钱、还会把集锁成只读，不能点一下就走。
  const [confirmExtract, setConfirmExtract] = useState(false)

  const pageMenuRef = useRef<HTMLDivElement>(null)
  useClickOutside(pageMenuRef, () => setPageMenu(false), pageMenu)

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

  const totalWords = episodes.reduce((n, e) => n + e.wordCount, 0)
  const drafts = episodes.filter((e) => !e.extractedAt)
  const draftWords = drafts.reduce((n, e) => n + e.wordCount, 0)
  const extractCost = costExtract(draftWords)

  // 异常只做「某集过短」这一条真实规则，按集算出一枚标签。
  //（「集号不连续」删了：集号是这一页自己顺延编出来的，永远连续，那条规则永远不会命中。）
  // 手动新建、还一个字没输的集，说的是「没内容」而不是「没切干净」——这是两件事，标签也分两种。
  // toast 文案里**不带字数**：正文可就地编辑，字数每敲一个字就变一次，
  // 带上它这行文案每次击键都是「新内容」，去重就废了、toast 会一路刷下去。
  // 具体几个字集头右边一直写着，这里只报「是哪一集、什么毛病」。
  const flags: Record<string, { badge: string; text: string }> = {}
  for (const e of episodes) {
    if (e.wordCount === 0) flags[e.id] = { badge: '内容为空', text: `第 ${e.no} 集还没有内容。` }
    else if (e.wordCount < 500) {
      flags[e.id] = { badge: '可能没切干净', text: `第 ${e.no} 集内容偏短，可能没切干净。` }
    }
  }

  // 异常从「列表上方那条长横幅」改成一次 toast + 集头的小标签（v2.11）：
  // 横幅常驻在正文上方，每次进这一页都要被跳读一次，久了就成了背景板；
  // 而「哪一集有问题」这件事本来就该长在那一集的集头上，不必让用户在横幅与列表之间对号入座。
  // toast 只在异常**内容变化**时发一次——用 ref 记住上一次的文案，重渲染不重复打扰。
  const anomalyText = episodes.map((e) => flags[e.id]?.text).filter(Boolean).join(' ')
  const lastAnomaly = useRef<string | null>(null)
  useEffect(() => {
    if (anomalyText === lastAnomaly.current) return
    lastAnomaly.current = anomalyText
    if (anomalyText) showToast(anomalyText)
  }, [anomalyText, showToast])

  const del = confirmDelete ? episodes.find((e) => e.id === confirmDelete) : undefined

  return (
    <div className={s.page}>
      {/* 整页只有这一个滚动容器：标题也跟着正文一起往上滚（钉住它只会白占一屏顶部）。
          foot 依旧钉在底部——那是「去下一步」的入口，滚走了就找不着。 */}
      <div className={s.scroll}>
        <div className={s.head}>
          <div className={s.wrap}>
            <div className={s.headInner}>
              <div className={s.headTitle}>共 {episodes.length} 集</div>
              <div className={s.menuWrap} ref={pageMenuRef}>
                <button
                  className={s.dots}
                  title="更多操作"
                  aria-label="更多操作"
                  aria-expanded={pageMenu}
                  onClick={() => setPageMenu((v) => !v)}
                >
                  {ic.more}
                </button>
                {/* 没有「重新上传剧本」（v2.5 §2.5）：换剧本 = 新建项目，演示里走顶栏「▶ 重新演示」。 */}
                {pageMenu && (
                  <div className={s.menuAt}>
                    <button
                      className={m.item}
                      disabled={hasSupplement}
                      title={hasSupplement ? '当前演示只有一份续集数据，已解析过' : undefined}
                      onClick={() => { setPageMenu(false); setSupplementOpen(true) }}
                    >
                      <span className={m.icon}>{ic.upload}</span>
                      上传文件 · 解析新集
                    </button>
                    <button
                      className={m.item}
                      onClick={() => { setPageMenu(false); createBlankEpisode() }}
                    >
                      <span className={m.icon}>{ic.add}</span>
                      新建一集
                    </button>
                    <button
                      className={m.item}
                      onClick={() => { setPageMenu(false); showToast('已导出剧本（示例，不落盘）') }}
                    >
                      <span className={m.icon}>{ic.download}</span>
                      下载剧本
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className={s.headSub}>
              当前已整理 {episodes.length} 集 · {totalWords.toLocaleString()} 字
            </div>
          </div>
        </div>

        <div className={s.wrap}>
        <div className={s.card}>
          {episodes.map((ep) => {
            const expanded = open.includes(ep.id)
            const locked = ep.extractedAt != null
            return (
              <div className={s.epBlock} key={ep.id} id={`ep-${ep.id}`}>
                <div className={s.epHead}>
                  <button className={s.caret} onClick={() => toggle(ep.id)} title={expanded ? '收起' : '展开'}>
                    {expanded ? ic.caretDown : ic.caretRight}
                  </button>
                  <button className={s.epNo} onClick={() => toggle(ep.id)}>第 {ep.no} 集</button>
                  {locked ? (
                    <span className={s.lock} title="已提取资产，不可再改">{ic.lock}</span>
                  ) : (
                    <span className={s.newBadge}>未拆解</span>
                  )}
                  {flags[ep.id] && (
                    <span className={s.warnBadge}>{ic.warn} {flags[ep.id]!.badge}</span>
                  )}
                  <span className={s.epWords}>{ep.wordCount.toLocaleString()} 字</span>
                  {/* 本集只剩一个操作：删除。悬停这一行才显形，不常驻占位。
                      已提取过资产的集删不得（它的资产已经在库里被引用），按钮禁用并说明原因。 */}
                  <button
                    className={s.epDel}
                    disabled={locked}
                    title={locked ? '已提取资产，不可删除' : '删除本集'}
                    onClick={() => setConfirmDelete(ep.id)}
                  >
                    {ic.trash}
                  </button>
                </div>
                {expanded && <EpisodeBody id={ep.id} rawText={ep.rawText} locked={locked} />}
              </div>
            )
          })}
        </div>
        </div>
      </div>

      {/* 底部横条（v2.8 §2）：和步骤② ③ 同一根条，不再是悬浮胶囊。
          只在「有草稿集等着提取」时出现——没有草稿就整条不渲染，
          这一页看完了点步骤条就行，不需要一个按钮催。 */}
      {drafts.length > 0 && (
        <div className={s.foot}>
          <span className={s.footText}>
            {committed
              ? `新增 ${drafts.length} 集，将只对新集提取资产`
              : `剧本内容整理完毕 · 共 ${episodes.length} 集 · ${totalWords.toLocaleString()} 字`}
          </span>
          <FlowButton
            cost={extractCost}
            title={`按字数计费 · ${fmtCost(RATE.extractPerKChar)} / 千字`}
            onClick={() => setConfirmExtract(true)}
          >
            资产提取
          </FlowButton>
        </div>
      )}

      {supplementOpen && (
        <ScriptSourceDialog mode="supplement" onClose={() => setSupplementOpen(false)} />
      )}

      {/* 进下一步的确认：这一步要花星钻，而且提取完这些集就锁成只读、正文不能再改。
          两件事都得在点之前说清楚，所以这里停一下。 */}
      {confirmExtract && (
        <Dialog onClose={() => setConfirmExtract(false)} className={d.dialog}>
          <div className={d.title}>提取资产</div>
          <div className={d.desc}>
            将对 {drafts.length} 集 · {draftWords.toLocaleString()} 字提取角色、服装、场景、道具。
            提取后这些集的正文不可再编辑。
          </div>
          <div className={d.footRow}>
            <span className={d.footNote}>消耗 {fmtCost(extractCost)}</span>
            <span className={d.footBtns}>
              <button className={ui.btn} onClick={() => setConfirmExtract(false)}>取消</button>
              <button
                className={[ui.btn, ui.btnPrimary].join(' ')}
                onClick={() => { setConfirmExtract(false); startExtract() }}
              >
                开始提取
              </button>
            </span>
          </div>
        </Dialog>
      )}

      {/* 删除本集：不可逆，走一次确认。 */}
      {del && (
        <Dialog onClose={() => setConfirmDelete(null)} className={d.dialog}>
          <div className={d.title}>删除第 {del.no} 集</div>
          <div className={d.desc}>
            这一集的 {del.wordCount.toLocaleString()} 字原文将从项目中移除，后续集号顺延。
            本集还没提取过资产，删除不影响项目资产库。此操作不可撤销。
          </div>
          <div className={d.actions}>
            <button className={ui.btn} onClick={() => setConfirmDelete(null)}>取消</button>
            <button
              className={[ui.btn, ui.btnDanger].join(' ')}
              onClick={() => { deleteDraftEpisode(del.id); setConfirmDelete(null) }}
            >
              删除本集
            </button>
          </div>
        </Dialog>
      )}
    </div>
  )
}
