import { memo, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { Dialog } from './Dialog'
import { useStore } from '../store/useStore'
import {
  CAMERA_MOVES,
  SHOT_SIZES,
  type Look,
  type MountableKind,
  type MountRef,
  type PromptState,
  type Shot,
} from '../data/types'
import { chipClass, KIND_LABEL } from './entity'
import { useEntityLit } from './EntityText'
import { mountIssues } from '../services/completeness'
import { isLongShot } from '../services/duration'
import { useAutoHideHover } from '../hooks/useAutoHideHover'
import { MountPicker } from './MountPicker'
import { ShotFieldCell } from './ShotFieldCell'
import { DialogueCell } from './DialogueCell'
import { ShotPromptDialog } from './ShotPromptDialog'
import ui from '../styles/ui.module.css'
import di from '../styles/dialog.module.css'
import s from './Storyboard.module.css'

function fmt(sec: number): string {
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`
}

/**
 * 角色卡（着装角色 / 角色兜底）。单独成组件是为了让它能自己订阅高亮 ——
 * hover「主要内容」里的角色名时只有这一张卡重渲染，不会把整张分镜表刷一遍。
 */
function CastPill({
  m,
  shotId,
  chName,
  costume,
  costumeWarn,
  readOnly,
  onRemove,
}: {
  m: MountRef
  shotId: string
  chName: string
  costume: string
  costumeWarn?: boolean
  readOnly: boolean
  onRemove: (e: MouseEvent) => void
}) {
  const lit = useEntityLit(m.assetId, shotId)
  return (
    <span className={[s.castPill, lit ? s.mountLit : ''].join(' ')}>
      <span className={s.roleDot} />
      <span className={s.castName}>{chName}</span>
      <span
        className={s.castCostume}
        style={costumeWarn ? { color: 'var(--amber)' } : undefined}
        title={costumeWarn ? '该角色还没有选择造型' : undefined}
      >
        {costume}
      </span>
      {!readOnly && (
        <button className={s.castX} onClick={onRemove} title="从本镜头移除">
          ✕
        </button>
      )}
    </span>
  )
}

/** 场景 / 道具 chip。同上，自己订阅高亮。 */
function MountChip({
  m,
  shotId,
  name,
  readOnly,
  onRemove,
}: {
  m: MountRef
  shotId: string
  name: string
  readOnly: boolean
  onRemove: (e: MouseEvent) => void
}) {
  const lit = useEntityLit(m.assetId, shotId)
  return (
    <span className={[ui.chip, chipClass(m.kind), s.chipHover, lit ? s.mountLit : ''].join(' ')}>
      <span className={ui.odot} />
      {name}
      {!readOnly && (
        <button className={[ui.chipX, s.chipHoverX].join(' ')} onClick={onRemove} title="从本镜头移除">
          ✕
        </button>
      )}
    </span>
  )
}

interface Props {
  shot: Shot
  startAt: number
  endAt: number
  active: boolean
  alt: boolean
  readOnly: boolean
  promptState: PromptState
  // 从「出场明细」跳转过来时短暂泛光。
  flash?: boolean
  onHover: (id: string | null) => void
  // 本镜在本场中的序号（插入位置用）。
  index: number
  // 悬停本行上沿 → 在本行之前插入一镜。只读时为 undefined，不渲染插入条。
  // 收参数而不是收闭包：闭包每次渲染都是新引用，memo 会直接失效。
  onInsertAbove?: (index: number) => void
  // 删除本镜（左侧操作栏的删除键）。只读时为 undefined。
  onDelete?: (shotId: string) => void
}

// memo：分镜表一屏 25 行，每行都要跑 mountIssues（正则匹配）与若干 EntityText 分词。
// hover 一行会让 SceneBlock 重渲染，没有 memo 就是 25 行全部重算一遍。
export const ShotRow = memo(function ShotRow({ shot, startAt, endAt, active, alt, readOnly, promptState, flash, onHover, index, onInsertAbove, onDelete }: Props) {
  const assets = useStore((st) => st.project.assets)
  const addMount = useStore((st) => st.addMount)
  const removeMount = useStore((st) => st.removeMount)
  const setDuration = useStore((st) => st.setShotDuration)

  // 点「查看提示词」→ 打开编辑弹窗，focus 记录点开时定位哪一段。
  const [editing, setEditing] = useState<'image' | 'video' | null>(null)
  // 「在此插入一镜」热区：悬停显形、停住几秒自动隐藏。
  const ins = useAutoHideHover()
  // 删除：点删除键先弹二次确认；确认后播放折叠动画，动画结束再真正从 store 移除。
  const [removing, setRemoving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  // 折叠动画的计时器要能被卸载打断：视图作用域一切、步骤一跳，这一行就不在了，
  // 定时器却还会在 240ms 后照删不误——那删掉的是用户没打算删的东西。
  const delTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(delTimer.current), [])
  const runDelete = () => {
    if (removing || !onDelete) return
    setRemoving(true)
    delTimer.current = window.setTimeout(() => onDelete(shot.id), 240)
  }

  // 挂载指向的资产可能已在项目资产库删除（v2.0 单向：资产库不回写分镜）→ 兜底显示「已失效」。
  const nameOf = (m: MountRef) => assets[m.assetId]?.name ?? '（已失效）'

  const step = (e: MouseEvent, delta: number) => {
    e.stopPropagation()
    setDuration(shot.id, shot.duration + delta)
  }
  const remove = (assetId: string) => (e: MouseEvent) => {
    e.stopPropagation()
    if (!readOnly) removeMount(shot.id, assetId)
  }
  const takeIssue = (assetId: string, kind: MountableKind) => (e: MouseEvent) => {
    e.stopPropagation()
    if (!readOnly) addMount(shot.id, { kind, assetId })
  }

  // 出场的人和物：固定三组「角色 / 场景 / 道具」，各组内挂载 chip + 该类目的虚线「+」追加钮。
  const looks = shot.mounts.filter((m) => m.kind === 'look')
  const charFallbacks = shot.mounts.filter((m) => m.kind === 'character')
  const locations = shot.mounts.filter((m) => m.kind === 'location')
  const props = shot.mounts.filter((m) => m.kind === 'prop')
  // 角色组：着装角色 + 角色兜底合成一列，每行一个，「+」跟在最后一行右边。
  const roleEntries = [...looks, ...charFallbacks]

  // 单张角色卡（着装角色 / 角色兜底）。删除叉是 hover 时右上角的浮层，不占卡片宽度。
  const roleCard = (m: MountRef) => {
    if (m.kind === 'look') {
      const look = assets[m.assetId] as Look | undefined
      const chName = look ? assets[look.characterId]?.name ?? '角色信息不可用' : '（已失效）'
      const cos = look ? look.costumeIds.map((id) => assets[id]?.name).filter(Boolean) : []
      return (
        <CastPill
          m={m}
          shotId={shot.id}
          chName={chName}
          costume={cos.length ? cos.join(' · ') : '默认着装'}
          readOnly={readOnly}
          onRemove={remove(m.assetId)}
        />
      )
    }
    return (
      <CastPill
        m={m}
        shotId={shot.id}
        chName={nameOf(m)}
        costume="⚠ 请选择角色造型"
        costumeWarn
        readOnly={readOnly}
        onRemove={remove(m.assetId)}
      />
    )
  }

  const issues = useMemo(() => mountIssues(shot, assets), [shot, assets])
  const long = isLongShot(shot.duration)
  const longWarn = (
    <div className={s.longWarn} title="该镜时长较长，部分视频模型可能需要分段生成。">
      ⚠ 较长
    </div>
  )


  // ⑨ 最终提示词状态格
  const promptCell = () => {
    if (promptState === 'generating') {
      return (
        <div className={s.pstat}>
          <span className={[s.badge, s.badgeGen].join(' ')}>
            <span className={s.sp} />
            生成中…
          </span>
        </div>
      )
    }
    if (promptState === 'ready') {
      return (
        <div className={s.pstat}>
          <button className={[s.badge, s.badgeReady].join(' ')} onClick={() => setEditing('image')}>
            查看提示词
          </button>
        </div>
      )
    }
    if (promptState === 'stale') {
      return (
        <div className={s.pstat}>
          <button className={[s.badge, s.badgeStale].join(' ')} onClick={() => setEditing('image')}>
            ⚠ 待更新
          </button>
        </div>
      )
    }
    return (
      <div className={s.pstat}>
        <button
          className={[s.badge, s.badgePending].join(' ')}
          onClick={() => setEditing('image')}
          title="点击打开提示词，可手动填写或一键生成"
        >
          待生成提示词
        </button>
      </div>
    )
  }

  return (
    <div
      data-shot-id={shot.id}
      className={[
        s.row,
        alt ? s.rowAlt : '',
        active ? s.rowOn : '',
        flash ? s.rowFlash : '',
        promptState === 'stale' ? s.rowStale : '',
        removing ? s.rowRemoving : '',
      ].join(' ')}
      onMouseEnter={() => onHover(shot.id)}
      onMouseLeave={() => onHover(null)}
    >
      {onInsertAbove && (
        <div
          className={[s.insRow, ins.visible ? s.insRowShow : ''].join(' ')}
          title="在此插入一镜"
          onMouseEnter={ins.onMouseEnter}
          onMouseMove={ins.onMouseMove}
          onMouseLeave={ins.onMouseLeave}
          onClick={(e) => {
            e.stopPropagation()
            if (ins.isVisible()) onInsertAbove(index)
          }}
        >
          <span className={s.insRowBar} />
          <span className={s.insRowPlus}>＋</span>
          <span className={s.insRowBar} />
        </div>
      )}

      {/* ① 镜头 · 时长：大号镜号 / 时长步进 / 底部小字时间范围 */}
      <div className={s.cNo}>
        <div className={s.noRow}>
          <span className={[s.noNum, active ? s.noNumOn : ''].join(' ')}>
            {String(shot.no).padStart(2, '0')}
          </span>
          <span className={s.noUnit}>镜</span>
        </div>
        {readOnly ? (
          <div className={s.durStatic}>{shot.duration} 秒</div>
        ) : (
          <div className={[s.stepper, active ? s.stepperOn : ''].join(' ')}>
            <button className={s.stepBtn} onClick={(e) => step(e, -1)} title="减少 1 秒">
              −
            </button>
            <span className={s.durVal}>{shot.duration} 秒</span>
            <button className={s.stepBtn} onClick={(e) => step(e, 1)} title="增加 1 秒">
              +
            </button>
          </div>
        )}
        <div className={s.tcRange}>
          {fmt(startAt)} → {fmt(endAt)}
        </div>
        {long && longWarn}
      </div>

      {/* ② 景别 / ③ 镜头设计 */}
      <ShotFieldCell
        shotId={shot.id}
        field="shotSize"
        value={shot.shotSize}
        readOnly={readOnly}
        variant="pill"
        label="景别"
        hint="可直接写「中远景 → 中景」"
        presets={SHOT_SIZES}
      />
      <ShotFieldCell
        shotId={shot.id}
        field="cameraMove"
        value={shot.cameraMove}
        readOnly={readOnly}
        variant="pill"
        label="镜头设计"
        hint="运镜 + 机位，点预设填入"
        presets={CAMERA_MOVES}
      />

      {/* ④ 出场的人和物：固定三组，各组内 chip + 该类目虚线「+」 */}
      <div className={s.cAsset}>
        <div className={s.assetGroups}>
          {/* 角色（着装角色 + 角色兜底）：每行一个角色，「+」跟在最后一行右边，长角色不换行 */}
          <div className={s.assetGroup}>
            <div className={s.groupTitle}>{KIND_LABEL.character}</div>
            <div className={[s.groupItems, s.groupItemsRole].join(' ')}>
              {roleEntries.map((m, idx) => (
                <div className={s.roleRow} key={m.assetId}>
                  {roleCard(m)}
                  {!readOnly && idx === roleEntries.length - 1 && (
                    <span className={s.addSlot}>
                      <MountPicker shotId={shot.id} mounts={shot.mounts} kinds={['look']} variant="add" />
                    </span>
                  )}
                </div>
              ))}
              {!readOnly && roleEntries.length === 0 && (
                <span className={s.addSlot}>
                  <MountPicker shotId={shot.id} mounts={shot.mounts} kinds={['look']} variant="add" />
                </span>
              )}
            </div>
          </div>

          {/* 场景 / 道具 */}
          {(
            [
              { kind: 'location', items: locations },
              { kind: 'prop', items: props },
            ] as { kind: MountableKind; items: MountRef[] }[]
          ).map((g) => (
            <div className={s.assetGroup} key={g.kind}>
              <div className={s.groupTitle}>{KIND_LABEL[g.kind]}</div>
              <div className={s.groupItems}>
                {g.items.map((m) => (
                  <MountChip
                    key={m.assetId}
                    m={m}
                    shotId={shot.id}
                    name={nameOf(m)}
                    readOnly={readOnly}
                    onRemove={remove(m.assetId)}
                  />
                ))}
                {!readOnly && (
                  <span className={s.addSlot}>
                    <MountPicker shotId={shot.id} mounts={shot.mounts} kinds={[g.kind]} variant="add" />
                  </span>
                )}
              </div>
            </div>
          ))}

          {issues.length > 0 && (
            <div className={s.assetActions}>
              {issues.map((iss, i) =>
                iss.level === 'action' && iss.assetId && iss.kind ? (
                  <button
                    key={`a${i}`}
                    className={s.issueAction}
                    disabled={readOnly}
                    onClick={takeIssue(iss.assetId, iss.kind)}
                    title="点击添加到镜头"
                  >
                    {iss.text}
                  </button>
                ) : (
                  <span key={`h${i}`} className={s.issueHint}>
                    {iss.text}
                  </span>
                ),
              )}
            </div>
          )}
        </div>
      </div>

      {/* ⑤ 主要内容（原 title）/ ⑥ 光影氛围 / ⑦ 对白 · 旁白 / ⑧ 音效 */}
      <ShotFieldCell
        shotId={shot.id}
        field="sourceQuote"
        value={shot.sourceQuote}
        readOnly={readOnly}
        variant="text"
        label="主要内容"
        hint="这一镜演什么，取材自剧本原文"
        rows={5}
        clamp={4}
        entities
      />
      <ShotFieldCell
        shotId={shot.id}
        field="lighting"
        value={shot.lighting}
        readOnly={readOnly}
        variant="text"
        label="光影氛围"
        rows={3}
        clamp={2}
        placeholder="—"
      />
      <DialogueCell shotId={shot.id} value={shot.dialogue} readOnly={readOnly} />
      <ShotFieldCell
        shotId={shot.id}
        field="sfx"
        value={shot.sfx}
        readOnly={readOnly}
        variant="text"
        label="音效"
        hint="镜级音效，会进视频提示词"
        rows={2}
        clamp={2}
        placeholder="—"
      />

      {/* ⑨ 最终提示词状态 */}
      <div className={s.cPromptStat}>{promptCell()}</div>

      {/* ⑩ 删除列：钉在最右，悬停本行时显现删除键 */}
      <div className={s.cDel}>
        {onDelete && (
          <button
            className={s.delBtn}
            title="删除本镜"
            disabled={removing}
            onClick={(e) => {
              e.stopPropagation()
              setConfirming(true)
            }}
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth={1.7}>
              <path d="M5 7h14M10 7V5h4v2M6 7l1 12h10l1-12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>

      {editing && (
        <ShotPromptDialog
          shot={shot}
          focus={editing}
          readOnly={readOnly}
          onClose={() => setEditing(null)}
        />
      )}

      {confirming && (
        <Dialog onClose={() => setConfirming(false)} className={di.dialog}>
          <div className={di.title}>删除第 {shot.no} 镜？</div>
          <div className={di.danger}>
            本镜的镜头设计、出场的人和物以及已生成的提示词将一并移除。此操作可撤销：删除后可在底部提示条中点「撤销」恢复。
          </div>
          <div className={di.actions}>
            <button className={ui.btn} onClick={() => setConfirming(false)}>
              取消
            </button>
            <button
              className={[ui.btn, ui.btnDanger].join(' ')}
              onClick={() => {
                setConfirming(false)
                runDelete()
              }}
            >
              删除
            </button>
          </div>
        </Dialog>
      )}
    </div>
  )
})
