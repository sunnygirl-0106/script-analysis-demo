import { useState, type MouseEvent } from 'react'
import { useStore } from '../store/useStore'
import type { Look, MountableKind, MountRef, Shot } from '../data/types'
import { chipClass, KIND_LABEL } from './entity'
import { mountIssues } from '../services/completeness'
import { isLongShot } from '../services/duration'
import { MountPicker } from './MountPicker'
import { PromptSections } from './PromptSections'
import { ShotPromptDialog } from './ShotPromptDialog'
import ui from '../styles/ui.module.css'
import s from './Storyboard.module.css'

function fmt(sec: number): string {
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`
}

interface Props {
  shot: Shot
  startAt: number
  endAt: number
  active: boolean
  alt: boolean
  readOnly: boolean
  onHover: (id: string | null) => void
}

export function ShotRow({ shot, startAt, endAt, active, alt, readOnly, onHover }: Props) {
  const assets = useStore((st) => st.project.assets)
  const addMount = useStore((st) => st.addMount)
  const removeMount = useStore((st) => st.removeMount)
  const setDuration = useStore((st) => st.setShotDuration)

  // 点提示词格子 → 打开编辑弹窗，focus 记录点的是哪一段。
  const [editing, setEditing] = useState<'image' | 'video' | null>(null)

  const nameOf = (m: MountRef) => assets[m.assetId]?.name ?? '该内容已移除'

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
  // 角色组含着装角色（look，人物参考卡）与角色兜底（未指定着装，加琥珀告警）。
  const looks = shot.mounts.filter((m) => m.kind === 'look')
  const charFallbacks = shot.mounts.filter((m) => m.kind === 'character')
  const locations = shot.mounts.filter((m) => m.kind === 'location')
  const props = shot.mounts.filter((m) => m.kind === 'prop')

  const issues = mountIssues(shot, assets)
  const long = isLongShot(shot.duration)
  const longWarn = (
    <div className={s.longWarn} title="该镜时长较长，部分视频模型可能需要分段生成。">
      ⚠ 较长
    </div>
  )

  return (
    <div
      className={[s.row, alt ? s.rowAlt : '', active ? s.rowOn : ''].join(' ')}
      onMouseEnter={() => onHover(shot.id)}
      onMouseLeave={() => onHover(null)}
    >
      {/* ① 镜头 · 时长（镜号胶囊 + 时间范围 + 标题 + 时长） */}
      <div className={s.cNo}>
        <div className={s.noLine}>
          <div className={[s.noPill, active ? s.noPillOn : ''].join(' ')}>
            {String(shot.no).padStart(2, '0')}
          </div>
          <div className={s.tcRange}>
            {fmt(startAt)} → {fmt(endAt)}
          </div>
        </div>
        <div className={s.shotTitle}>{shot.title}</div>
        {readOnly ? (
          <>
            <div className={s.durStatic}>{shot.duration} 秒</div>
            {long && longWarn}
          </>
        ) : (
          <>
            <div className={[s.stepper, active ? s.stepperOn : ''].join(' ')}>
              <button className={s.stepBtn} onClick={(e) => step(e, -1)} title="减少 1 秒">
                −
              </button>
              <span className={s.durVal}>{shot.duration} 秒</span>
              <button className={s.stepBtn} onClick={(e) => step(e, 1)} title="增加 1 秒">
                +
              </button>
            </div>
            {long && longWarn}
          </>
        )}
      </div>

      {/* ② 出场的人和物：固定三组，各组内 chip + 该类目虚线「+」 */}
      <div className={s.cAsset}>
        <div className={s.assetGroups}>
          {/* 角色（着装角色 + 角色兜底） */}
          <div className={s.assetGroup}>
            <div className={s.groupTitle}>{KIND_LABEL.character}</div>
            <div className={[s.groupItems, s.groupItemsRole].join(' ')}>
              {looks.map((m) => {
                const look = assets[m.assetId] as Look | undefined
                const chName = look ? assets[look.characterId]?.name ?? '角色信息不可用' : '该内容已移除'
                const cos = look ? look.costumeIds.map((id) => assets[id]?.name).filter(Boolean) : []
                return (
                  <span className={s.castPill} key={m.assetId}>
                    <span className={s.roleDot} />
                    <span className={s.castName}>{chName}</span>
                    <span className={s.castCostume}>{cos.length ? cos.join(' · ') : '默认着装'}</span>
                    {!readOnly && (
                      <button className={s.castX} onClick={remove(m.assetId)} title="从本镜头移除">
                        ✕
                      </button>
                    )}
                  </span>
                )
              })}
              {charFallbacks.map((m) => {
                const name = nameOf(m)
                return (
                  <span className={s.castPill} key={m.assetId}>
                    <span className={s.roleDot} />
                    <span className={s.castName}>{name}</span>
                    <span
                      className={s.castCostume}
                      style={{ color: 'var(--amber)' }}
                      title="该角色还没有选择造型"
                    >
                      ⚠ 请选择角色造型
                    </span>
                    {!readOnly && (
                      <button className={s.castX} onClick={remove(m.assetId)} title="从本镜头移除">
                        ✕
                      </button>
                    )}
                  </span>
                )
              })}
              {!readOnly && (
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
                  <span key={m.assetId} className={[ui.chip, chipClass(m.kind)].join(' ')}>
                    <span className={ui.odot} />
                    {nameOf(m)}
                    {!readOnly && (
                      <button className={ui.chipX} onClick={remove(m.assetId)} title="从本镜头移除">
                        ✕
                      </button>
                    )}
                  </span>
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

      {/* ③ 画面提示词 / ④ 视频提示词：行内只给摘要，点击打开弹窗编辑全文 */}
      <div
        className={[s.cPrompt, s.cPromptClickable].join(' ')}
        onClick={() => setEditing('image')}
        title="点击编辑画面提示词"
      >
        <div className={s.promptBlock}>
          <div className={s.promptClamp}>
            <PromptSections text={shot.imagePrompt} />
          </div>
        </div>
      </div>
      <div
        className={[s.cPrompt, s.cPromptClickable].join(' ')}
        onClick={() => setEditing('video')}
        title="点击编辑视频提示词"
      >
        <div className={s.promptBlock}>
          <div className={s.promptClamp}>
            <PromptSections text={shot.videoPrompt} />
          </div>
        </div>
      </div>

      {editing && (
        <ShotPromptDialog
          shot={shot}
          focus={editing}
          readOnly={readOnly}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
