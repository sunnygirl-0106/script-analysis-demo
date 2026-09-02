import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react'
import { useStore } from '../store/useStore'
import { useAutoHideHover } from '../hooks/useAutoHideHover'
import type { Scene } from '../data/types'
import { computeTimeline, sceneDuration } from '../services/timeline'
import { SceneTimeline } from './SceneTimeline'
import { SceneSettingsDrawer } from './SceneSettingsDrawer'
import { ShotRow } from './ShotRow'
import s from './Storyboard.module.css'

function fmt(sec: number): string {
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`
}

// 九列脚本表，全部像素宽、可整列任意高度拖拽（对齐设计稿）。最后一列「最终提示词」钉在右侧不参与拖拽。
const HEAD = ['镜号 · 时长', '景别', '镜头设计', '出场的人和物', '主要内容', '光影氛围', '对白 · 旁白', '音效', '最终提示词']
const DEFAULT_WIDTHS = [112, 96, 136, 252, 320, 150, 220, 130, 150]
const MIN_WIDTHS = [96, 76, 100, 170, 240, 100, 140, 96, 130]
// 最右侧固定的删除列宽（钉在「最终提示词」右边，不参与拖拽）。需与 CSS 中 .cPromptStat 的 right 偏移一致。
const DEL_W = 46

/**
 * 分镜表（v2.7 §5.4）。从「一次一场」改成**一次一批场**：接 `scenes`，每场一个纵向区块。
 *
 * 全剧 / 本集 / 本场三种视图共用这一个组件，区别只有传进来几场、以及要不要时间轴——
 * 表头只在最顶上渲染一次，列宽 state 也只有顶层这一份，所以三个区块的列永远是对齐的。
 * 这就是「每场一张独立表格」这条路被否掉的原因：那样列宽会各走各的，纵向扫读立刻散架。
 */
export function Storyboard({
  scenes, readOnly, showTimeline,
}: {
  scenes: Scene[]
  readOnly: boolean
  /** 只有「本场」视图渲染场时间轴；全剧 / 本集视图省下这段高度（v2.7 §5.4）。 */
  showTimeline: boolean
}) {
  const shots = useStore((st) => st.project.shots)
  const flashShotIds = useStore((st) => st.flashShotIds)

  // 高亮完全由悬停驱动：不悬停就没有任何镜被高亮。跨场按 shotId 走，互不干扰。
  const [hoverId, setHoverId] = useState<string | null>(null)
  // ── 列宽（可拖拽）：一份，所有场区块共用 ──
  const [widths, setWidths] = useState<number[]>(DEFAULT_WIDTHS)
  const [dragCol, setDragCol] = useState<number | null>(null)
  const drag = useRef<{ i: number; startX: number; startW: number } | null>(null)

  const startDrag = (i: number) => (e: ReactMouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    drag.current = { i, startX: e.clientX, startW: widths[i] }
    setDragCol(i)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  useEffect(() => {
    const move = (e: MouseEvent) => {
      const d = drag.current
      if (!d) return
      const w = Math.max(MIN_WIDTHS[d.i], d.startW + (e.clientX - d.startX))
      setWidths((prev) => {
        if (prev[d.i] === w) return prev
        const next = [...prev]
        next[d.i] = w
        return next
      })
    }
    const up = () => {
      if (!drag.current) return
      drag.current = null
      setDragCol(null)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
  }, [])

  // 九列可拖宽 + 末尾固定删除列。
  const template = widths.map((w) => `${w}px`).join(' ') + ` ${DEL_W}px`
  const gridW = widths.reduce((a, w) => a + w, 0) + DEL_W
  const gridStyle = { '--cols': template, width: gridW, minWidth: '100%' } as CSSProperties

  // 全高列宽把手：压在每条竖分隔线上，整列任意高度都可拖。最终提示词列与删除列钉右不参与。
  const handles: { i: number; left: number }[] = []
  {
    let acc = 0
    for (let i = 0; i < widths.length - 1; i++) {
      acc += widths[i]
      handles.push({ i, left: acc })
    }
  }

  // ── 最终提示词列的悬浮阴影：默认显示（有内容被它挡住），只有横向滚到最右端才去掉 ──
  const scrollRef = useRef<HTMLDivElement>(null)
  const [atRight, setAtRight] = useState(false)
  const shotTotal = scenes.reduce((n, sc) => n + sc.shotIds.length, 0)
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const update = () => {
      const max = el.scrollWidth - el.clientWidth
      setAtRight(max <= 1 || el.scrollLeft >= max - 1)
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      el.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [shotTotal, gridW])

  // 从「出场明细」跳转过来：把首个被高亮的镜头滚到视野中央。
  useEffect(() => {
    if (!flashShotIds.length) return
    const el = scrollRef.current?.querySelector(`[data-shot-id="${flashShotIds[0]}"]`)
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [flashShotIds])

  const only = scenes.length === 1 ? scenes[0] : undefined

  return (
    <div className={s.pane}>
      <SceneSettingsDrawer />
      {showTimeline && only && (
        <SceneTimeline scene={only} shots={shots} activeId={hoverId} onHover={setHoverId} />
      )}
      {readOnly && <div className={s.lockNote}>🔒 已进入项目资产库，剧本分析只读</div>}

      <div className={[s.scroll, atRight ? s.scrollAtEnd : ''].join(' ')} ref={scrollRef}>
        <div className={s.grid} style={gridStyle}>
          <div className={s.header}>
            {HEAD.map((h, i) => (
              <div
                className={[
                  s.hCell,
                  i === HEAD.length - 1 ? s.hCellPrompt : '',
                  // 镜号 / 景别 / 镜头设计 / 最终提示词 四列居中
                  i === 0 || i === 1 || i === 2 || i === HEAD.length - 1 ? s.hCellCenter : '',
                ].join(' ')}
                key={i}
              >
                {h}
              </div>
            ))}
            <div className={[s.hCell, s.hCellDel].join(' ')} />
          </div>

          {scenes.map((sc) => (
            <SceneBlock
              key={sc.id}
              scene={sc}
              readOnly={readOnly}
              hoverId={hoverId}
              onHover={setHoverId}
            />
          ))}

          {scenes.length === 0 && (
            <div className={s.emptyScene}>当前范围内还没有场</div>
          )}

          {/* 全高列宽把手层：覆盖整张表，pointer-events 只在把手上生效 */}
          <div className={s.handleLayer}>
            {handles.map((h) => (
              <div
                key={h.i}
                className={s.colHandle}
                style={{ left: h.left - 5 }}
                onMouseDown={startDrag(h.i)}
                title="拖拽调整列宽（整列任意高度都可拖）"
              >
                <span className={[s.colHandleLine, dragCol === h.i ? s.colHandleLineOn : ''].join(' ')} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * 一场 = 一个区块：区块头 + 若干镜头行 + 收尾行。
 *
 * 区块头只剩标题（点了 = 只看这一场）+ `N 镜 · N 秒`（v2.8 §8）。「场级设定」「重拆本场」
 * 两个按钮撤了：一场一份、每场重复一遍的按钮，扫全剧时就是几十个重复的口。
 * 场级设定归单场视图时间轴上的「⚙ 情绪与配乐」，重拆本场归左侧目录场行的 ⋯ 菜单，各一个入口。
 *
 * 返回 Fragment 而不是包一层 div —— 每一行都得是 `.grid` 的直接子节点，
 * 列宽变量 `--cols` 才管得到它们，包一层就散了。
 * 镜号仍是场内编号（1、2、3…）：区块头已经交代了这是哪一集哪一场。
 */
function SceneBlock({
  scene, readOnly, hoverId, onHover,
}: {
  scene: Scene
  readOnly: boolean
  hoverId: string | null
  onHover: (id: string | null) => void
}) {
  const shots = useStore((st) => st.project.shots)
  const episodes = useStore((st) => st.project.episodes)
  const promptStates = useStore((st) => st.promptStates)
  const insertShot = useStore((st) => st.insertShot)
  const deleteShot = useStore((st) => st.deleteShot)
  // 稳定引用，否则下面 25 行的 memo 每次渲染都会被新箭头函数打穿。
  const handleInsertAbove = useCallback((i: number) => insertShot(scene.id, i), [insertShot, scene.id])
  const handleDelete = useCallback((id: string) => deleteShot(id), [deleteShot])
  const flashShotIds = useStore((st) => st.flashShotIds)
  const setViewScope = useStore((st) => st.setViewScope)
  // 表尾「在末尾插入一镜」热区：悬停显形、停住几秒自动隐藏。每个区块各一套。
  const appendIns = useAutoHideHover()

  const timeline = useMemo(() => computeTimeline(scene, shots), [scene, shots])
  const total = useMemo(() => sceneDuration(scene, shots), [scene, shots])
  const epNo = episodes.find((e) => e.sceneIds.includes(scene.id))?.no

  return (
    <>
      <div className={s.sceneBar}>
        <button
          className={s.sceneBarMain}
          title="只看这一场"
          onClick={() => setViewScope({ kind: 'scene', sceneId: scene.id })}
        >
          <span className={s.sceneBarTitle}>
            {epNo != null && <>第 {epNo} 集 · </>}第 {scene.no} 场 · {scene.name}
          </span>
          <span className={s.sceneBarMeta}>{scene.shotIds.length} 镜 · {total} 秒</span>
        </button>
      </div>

      {timeline.map((entry, i) => {
        const shot = shots[entry.shotId]
        if (!shot) return null
        return (
          <ShotRow
            key={shot.id}
            shot={shot}
            startAt={entry.startAt}
            endAt={entry.endAt}
            active={hoverId === shot.id}
            alt={i % 2 === 1}
            readOnly={readOnly}
            promptState={promptStates[shot.id] ?? 'pending'}
            flash={flashShotIds.includes(shot.id)}
            onHover={onHover}
            index={i}
            onInsertAbove={readOnly ? undefined : handleInsertAbove}
            onDelete={readOnly ? undefined : handleDelete}
          />
        )
      })}

      {timeline.length === 0 && (
        <div className={s.emptyScene}>
          本场还没有镜头，用「插入镜头」手动添加
        </div>
      )}

      <div className={s.tail}>
        {!readOnly && (
          <div
            className={[s.insRow, appendIns.visible ? s.insRowShow : ''].join(' ')}
            title="在末尾插入一镜"
            onMouseEnter={appendIns.onMouseEnter}
            onMouseMove={appendIns.onMouseMove}
            onMouseLeave={appendIns.onMouseLeave}
            onClick={() => {
              if (appendIns.isVisible()) insertShot(scene.id, timeline.length)
            }}
          >
            <span className={s.insRowBar} />
            <span className={s.insRowPlus}>＋</span>
            <span className={s.insRowBar} />
          </div>
        )}
        <div className={s.tailNo}>{fmt(total)}</div>
        <div className={s.tailText}>本场共 {total} 秒</div>
      </div>
    </>
  )
}
