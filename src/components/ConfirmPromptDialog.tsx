import { useEffect, useMemo, useRef, useState } from 'react'
import { Dialog } from './Dialog'
import { useStore } from '../store/useStore'
import type { Project, Shot } from '../data/types'
import {
  defaultSelection,
  groupByScene,
  shotIdsOfScope,
  type PromptScope,
} from '../services/promptScope'
import { PencilIcon } from './PencilIcon'
import { costShotPrompts, fmtCost } from '../services/cost'
import { PHASES, taskDuration } from '../services/taskRun'
import { TaskProgress } from './TaskProgress'
import ui from '../styles/ui.module.css'
import d from '../styles/dialog.module.css'
import c from './ConfirmPromptDialog.module.css'
import { ic } from './icons'

// 「生成镜头提示词」前置确认。范围由组件自己按 scope 求解（本场 / 本集 / 全剧），
// 按场分组勾选，逐镜带四状态 + 手动编辑角标。模型下拉与「智能合成/自动拼接」为演示视觉控件，
// 不进数据模型、不影响生成——真正落地的只是对勾选镜调用 onConfirm→generatePrompts。
const SCOPE_LABEL: Record<PromptScope, string> = { scene: '本场', episode: '本集', project: '全剧' }
const SCOPES: PromptScope[] = ['scene', 'episode', 'project']

// 状态过滤（顶部右侧）：全部 / 仅待更新（stale）/ 仅未生成（pending）。
type StateFilter = 'all' | 'stale' | 'pending'
const FILTERS: { key: StateFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'stale', label: '仅待更新' },
  { key: 'pending', label: '仅未生成' },
]

// 把镜头字段合成一行可读提示词预览：运镜、焦段。景别。摘要。光影 台词 音效 出场:资产。
// 折叠时 CSS 只显一行，展开时整段可见——两态同一串文本，天然对齐。
function composePreview(shot: Shot, project: Project): string {
  const head = [shot.cameraMove, shot.lens].filter(Boolean).join('，')
  const parts: string[] = []
  if (head) parts.push(head + '。')
  if (shot.shotSize) parts.push(shot.shotSize + '。')
  if (shot.title) parts.push(shot.title + '。')
  if (shot.lighting) parts.push(shot.lighting)
  if (shot.dialogue && shot.dialogue !== '无') parts.push(shot.dialogue)
  if (shot.sfx) parts.push(shot.sfx)
  const mounts = shot.mounts.map((m) => project.assets[m.assetId]?.name).filter(Boolean)
  if (mounts.length) parts.push(`出场：${mounts.join('、')}。`)
  return parts.join(' ').trim()
}

const fmtDur = (s: number) => (s % 1 === 0 ? `${s}s` : `${s.toFixed(1)}s`)

export function ConfirmPromptDialog({
  defaultScope,
  onConfirm,
  onClose,
}: {
  defaultScope: PromptScope // 'scene'（页脚按钮）| 'project'（完成度提示）
  onConfirm: (ids: string[]) => void
  onClose: () => void
}) {
  const project = useStore((st) => st.project)
  const states = useStore((st) => st.promptStates)
  const edited = useStore((st) => st.promptEdited)
  const selectedSceneId = useStore((st) => st.selectedSceneId)
  const showToast = useStore((st) => st.showToast)

  const [scope, setScope] = useState<PromptScope>(defaultScope)

  // 范围内镜头（集→场→镜自然序）与分组，随 scope 变。
  const ids = useMemo(() => shotIdsOfScope(project, scope, selectedSceneId), [project, scope, selectedSceneId])
  const groups = useMemo(() => groupByScene(project, ids), [project, ids])

  const stateOf = (id: string) => states[id] ?? 'pending'
  const selectable = (id: string) => stateOf(id) !== 'generating'

  const [selected, setSelected] = useState<Set<string>>(() => defaultSelection(ids, states))
  const [running, setRunning] = useState(false)
  // 默认展开：当前场展开，其余折叠；scope==='scene' 只有一组，恒展开。
  const defaultOpen = () =>
    new Set(scope === 'scene' ? groups.map((g) => g.sceneId) : [selectedSceneId])
  const [open, setOpen] = useState<Set<string>>(defaultOpen)
  const [mode, setMode] = useState<'smart' | 'concat'>('smart')
  const [filter, setFilter] = useState<StateFilter>('all')
  // 逐镜展开：显示整段合成提示词。默认全折叠。
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  // 过滤谓词：随右上「全部/仅待更新/仅未生成」变。作用于展示，不影响已勾选集合。
  const passFilter = (id: string) => {
    if (filter === 'stale') return stateOf(id) === 'stale'
    if (filter === 'pending') return stateOf(id) === 'pending'
    return true
  }

  // 切换范围 = 按新范围默认勾选整体重置（不保留用户手动勾选）。逻辑收在此处便于后续换策略。
  const onScopeChange = (next: PromptScope) => {
    if (next === scope) return
    const nextIds = shotIdsOfScope(project, next, selectedSceneId)
    const nextGroups = groupByScene(project, nextIds)
    setScope(next)
    setSelected(defaultSelection(nextIds, states))
    setOpen(new Set(next === 'scene' ? nextGroups.map((g) => g.sceneId) : [selectedSceneId]))
    setFilter('all')
    showToast(`已按${SCOPE_LABEL[next]}范围重新勾选`)
  }

  const total = ids.length
  const totalDur = useMemo(
    () => ids.reduce((sum, id) => sum + (project.shots[id]?.duration ?? 0), 0),
    [ids, project.shots],
  )
  const selCount = selected.size
  const allSelectable = ids.filter(selectable)
  const allOn = allSelectable.length > 0 && allSelectable.every((id) => selected.has(id))
  const someOn = selCount > 0 && !allOn
  const cost = costShotPrompts([...selected]) // 每镜 ✦6

  const allRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = someOn
  }, [someOn])

  const toggle = (id: string) => {
    if (!selectable(id)) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleGroup = (shotIds: string[]) => {
    const sel = shotIds.filter(selectable)
    const on = sel.length > 0 && sel.every((id) => selected.has(id))
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) sel.forEach((id) => next.delete(id))
      else sel.forEach((id) => next.add(id))
      return next
    })
  }

  const toggleAll = () =>
    setSelected(allOn ? new Set() : new Set(allSelectable))

  const toggleOpen = (sceneId: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(sceneId)) next.delete(sceneId)
      else next.add(sceneId)
      return next
    })

  return (
    <Dialog
      onClose={onClose}
      className={c.dialog}
    >
      <div className={c.head}>
        <div className={c.headTop}>
          <div className={c.headLeft}>
            <span className={[d.title, d.titleLg].join(' ')}>生成镜头提示词</span>
            <span
              className={c.help}
              title="仅对下方勾选的镜头生成提示词。已生成的镜头默认不重复生成，可手动勾选以覆盖。"
            >
              ?
            </span>
          </div>
          <div className={c.headRight}>
            <div className={c.headMeta}>
              <span className={c.headCount}>
                已选 <b>{selCount}</b> / {total} 镜
              </span>
              <span className={c.progress}>
                <span
                  className={c.progressFill}
                  style={{ width: `${total ? (selCount / total) * 100 : 0}%` }}
                />
              </span>
            </div>
            <button className={d.close} onClick={onClose} title="关闭" aria-label="关闭">
              {ic.close}
            </button>
          </div>
        </div>

        {/* 范围快速选择 + 汇总 + 状态过滤 */}
        <div className={c.scopeBar}>
          <div className={d.seg}>
            {SCOPES.map((sc) => (
              <button
                key={sc}
                className={[d.segBtn, scope === sc ? d.segOn : ''].join(' ')}
                onClick={() => onScopeChange(sc)}
              >
                {SCOPE_LABEL[sc]}
              </button>
            ))}
          </div>
          <div className={c.scopeRight}>
            <span className={c.summary}>
              共 {total} 镜 · 约 {fmtDur(totalDur)}
            </span>
            <span className={c.filterSep} />
            <div className={c.filters}>
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  className={[c.filterBtn, filter === f.key ? c.filterOn : ''].join(' ')}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className={c.list}>
        {groups.map((g) => {
          const shownIds = g.shotIds.filter(passFilter)
          if (shownIds.length === 0) return null
          const isOpen = open.has(g.sceneId)
          const sel = g.shotIds.filter(selectable)
          const gOn = sel.length > 0 && sel.every((id) => selected.has(id))
          const gSome = g.shotIds.some((id) => selected.has(id)) && !gOn
          const gSelCount = g.shotIds.filter((id) => selected.has(id)).length
          return (
            <div className={[c.group, isOpen ? c.groupOpen : ''].join(' ')} key={g.sceneId}>
              <div className={c.groupHead} onClick={() => toggleOpen(g.sceneId)}>
                <input
                  type="checkbox"
                  className={c.check}
                  checked={gOn}
                  ref={(el) => {
                    if (el) el.indeterminate = gSome
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => toggleGroup(g.shotIds)}
                />
                <span className={c.groupTitle}>
                  第 {g.episodeNo} 集 · 第 {g.sceneNo} 场 {g.sceneName}
                </span>
                <span className={c.groupCount}>
                  已选 {gSelCount}/{g.shotIds.length}
                </span>
                <span className={[c.caret, isOpen ? c.caretOpen : ''].join(' ')} title={isOpen ? '折叠' : '展开'}>
                  ›
                </span>
              </div>

              {isOpen && (
                <div className={c.shots}>
                  {shownIds.map((id) => {
                    const shot = project.shots[id]
                    if (!shot) return null
                    const isEdited = !!edited[id]
                    const checked = selected.has(id)
                    const isExpanded = expanded.has(id)
                    const preview = composePreview(shot, project)
                    return (
                      <div
                        className={[c.shotRow, isExpanded ? c.shotExpanded : ''].join(' ')}
                        key={id}
                      >
                        <div
                          className={c.shotTop}
                          onClick={() => toggleExpand(id)}
                          title={isExpanded ? '收起' : '展开完整提示词'}
                        >
                          <input
                            type="checkbox"
                            className={[c.check, c.checkSm].join(' ')}
                            checked={checked}
                            disabled={!selectable(id)}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => toggle(id)}
                          />
                          <span className={c.mno}>镜 {shot.no}</span>
                          <span className={c.mdur}>{fmtDur(shot.duration)}</span>
                          <span className={[c.mprev, isExpanded ? c.mprevOpen : ''].join(' ')}>
                            {preview}
                          </span>
                          {isEdited && (
                            <span className={c.editTag} title="提示词经过手动编辑">
                              <PencilIcon /> 手动
                            </span>
                          )}
                          <span className={[c.rowCaret, isExpanded ? c.caretOpen : ''].join(' ')}>
                            ›
                          </span>
                        </div>
                        {isEdited && checked && (
                          <div className={c.warnRow}>
                            该镜提示词经过手动编辑，重新生成会覆盖当前内容。
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className={c.foot}>
        <div className={c.footRow}>
          <div className={c.footLeft}>
            <label className={c.all}>
              <input ref={allRef} type="checkbox" className={c.check} checked={allOn} onChange={toggleAll} />
              全选镜头
            </label>
            <span className={c.model}>GVLM 3.1 {ic.caretDown}</span>
          </div>

          {running ? (
            <span className={c.running}>
              <TaskProgress
                phases={PHASES.shotPrompt}
                durationMs={taskDuration(cost)}
                onDone={() => onConfirm([...selected])}
              />
            </span>
          ) : (
            <div className={c.footRight}>
              <div className={[d.seg, c.modes].join(' ')}>
                <button
                  className={[d.segBtn, c.modeBtn, mode === 'smart' ? d.segOn : ''].join(' ')}
                  onClick={() => setMode('smart')}
                >
                  智能合成
                </button>
                <button
                  className={[d.segBtn, c.modeBtn, mode === 'concat' ? d.segOn : ''].join(' ')}
                  onClick={() => setMode('concat')}
                >
                  自动拼接
                </button>
              </div>
              <span className={c.cost}>{fmtCost(cost)}</span>
              <button
                className={[ui.btn, ui.btnPrimary].join(' ')}
                disabled={selCount === 0}
                onClick={() => setRunning(true)}
              >
                确认并生成 · {fmtCost(cost)}
              </button>
            </div>
          )}
        </div>
        <div className={c.hint}>内容修改后自动保存为最新版本</div>
      </div>
    </Dialog>
  )
}
