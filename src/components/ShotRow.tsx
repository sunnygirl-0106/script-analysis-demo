import type { MouseEvent } from 'react'
import { useStore } from '../store/useStore'
import type { Look, MountableKind, MountRef, Shot } from '../data/types'
import { chipClass, KIND_LABEL } from './entity'
import { mountIssues } from '../services/completeness'
import { isLongShot } from '../services/duration'
import { MountPicker } from './MountPicker'
import { PromptSections } from './PromptSections'
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
  open: boolean
  readOnly: boolean
  onHover: (id: string | null) => void
  onToggle: (id: string) => void
}

export function ShotRow({ shot, startAt, endAt, active, alt, open, readOnly, onHover, onToggle }: Props) {
  const assets = useStore((st) => st.project.assets)
  const addMount = useStore((st) => st.addMount)
  const removeMount = useStore((st) => st.removeMount)
  const setDuration = useStore((st) => st.setShotDuration)

  const nameOf = (m: MountRef) => assets[m.assetId]?.name ?? '（已删除）'

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

  // 整行可点开详情，但落在按钮 / 输入框上的点击交给它们自己处理。
  const onRowClick = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, input, a')) return
    onToggle(shot.id)
  }

  // 关联资产分组：着装角色（人物参考）走 cast 卡；角色兜底（未指定着装）加琥珀告警；场景 / 道具走标签行。
  const looks = shot.mounts.filter((m) => m.kind === 'look')
  const charFallbacks = shot.mounts.filter((m) => m.kind === 'character')
  const rows = (
    [
      { label: KIND_LABEL.location, kind: 'location', items: shot.mounts.filter((m) => m.kind === 'location') },
      { label: KIND_LABEL.prop, kind: 'prop', items: shot.mounts.filter((m) => m.kind === 'prop') },
    ] as { label: string; kind: MountableKind; items: MountRef[] }[]
  ).filter((r) => r.items.length > 0)

  const issues = mountIssues(shot, assets)
  const long = isLongShot(shot.duration)
  const longWarn = (
    <div className={s.longWarn} title="该镜时长较长，部分视频模型可能需要分段生成。">
      ⚠ 较长
    </div>
  )

  return (
    <div
      className={[s.row, alt ? s.rowAlt : '', active ? s.rowOn : '', open ? s.rowOpen : ''].join(' ')}
      onMouseEnter={() => onHover(shot.id)}
      onMouseLeave={() => onHover(null)}
      onClick={onRowClick}
    >
      {/* ① 镜头 · 时长（镜号胶囊 + 标题 + 时长 + 时间范围 + 展开箭头） */}
      <div className={s.cNo}>
        <div className={s.noLine}>
          <div className={[s.noPill, active || open ? s.noPillOn : ''].join(' ')}>
            {String(shot.no).padStart(2, '0')}
          </div>
          <button
            className={[s.caret, open ? s.caretOn : ''].join(' ')}
            onClick={(e) => {
              e.stopPropagation()
              onToggle(shot.id)
            }}
            title={open ? '收起提示词全文' : '展开提示词全文'}
            aria-expanded={open}
          >
            ▸
          </button>
        </div>
        <div className={s.shotTitle}>{shot.title}</div>
        {readOnly ? (
          <>
            <div className={s.durStatic}>{shot.duration}s</div>
            {long && longWarn}
          </>
        ) : (
          <>
            <div className={[s.stepper, active ? s.stepperOn : ''].join(' ')}>
              <button className={s.stepBtn} onClick={(e) => step(e, -1)} title="减少 1s">
                −
              </button>
              <span className={s.durVal}>{shot.duration}s</span>
              <button className={s.stepBtn} onClick={(e) => step(e, 1)} title="增加 1s">
                +
              </button>
            </div>
            {long && longWarn}
          </>
        )}
        <div className={s.tcRange}>
          {fmt(startAt)} → {fmt(endAt)}
        </div>
      </div>

      {/* ② 关联资产 */}
      <div className={s.cAsset}>
        <div className={s.assetStack}>
          {looks.map((m) => {
            const look = assets[m.assetId] as Look | undefined
            const chName = look ? assets[look.characterId]?.name ?? '未知角色' : '（已删除）'
            const cos = look ? look.costumeIds.map((id) => assets[id]?.name).filter(Boolean) : []
            return (
              <div className={s.cast} key={m.assetId}>
                <span className={s.avatar}>{chName.slice(0, 1)}</span>
                <span className={s.castMeta}>
                  <span className={s.castName}>{chName}</span>
                  <span className={s.castCostume}>{cos.length ? cos.join(' · ') : '默认着装'}</span>
                </span>
                {!readOnly && (
                  <button className={s.castX} onClick={remove(m.assetId)} title="移除挂载">
                    ✕
                  </button>
                )}
              </div>
            )
          })}
          {charFallbacks.map((m) => {
            const name = nameOf(m)
            return (
              <div className={s.cast} key={m.assetId}>
                <span className={s.avatar}>{name.slice(0, 1)}</span>
                <span className={s.castMeta}>
                  <span className={s.castName}>{name}</span>
                  <span className={s.castCostume} style={{ color: 'var(--amber)' }} title="AI 只拆出了人、没给着装，页面出琥珀告警">
                    ⚠ 未指定着装
                  </span>
                </span>
                {!readOnly && (
                  <button className={s.castX} onClick={remove(m.assetId)} title="移除挂载">
                    ✕
                  </button>
                )}
              </div>
            )
          })}

          {rows.map((r) => (
            <div className={s.assetRow} key={r.kind}>
              <span className={s.rowLabel}>{r.label}</span>
              <span className={s.rowChips}>
                {r.items.map((m) => (
                  <span key={m.assetId} className={[ui.chip, chipClass(m.kind)].join(' ')}>
                    <span className={ui.odot} />
                    {nameOf(m)}
                    {!readOnly && (
                      <button className={ui.chipX} onClick={remove(m.assetId)} title="移除挂载">
                        ✕
                      </button>
                    )}
                  </span>
                ))}
              </span>
            </div>
          ))}

          <div className={s.assetActions}>
            <MountPicker shotId={shot.id} mounts={shot.mounts} disabled={readOnly} />
            {issues.map((iss, i) =>
              iss.level === 'action' && iss.assetId && iss.kind ? (
                <button
                  key={`a${i}`}
                  className={s.issueAction}
                  disabled={readOnly}
                  onClick={takeIssue(iss.assetId, iss.kind)}
                  title="点击直接挂载"
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
        </div>
      </div>

      {/* ③ 画面提示词 / ④ 视频提示词：行内只给摘要，底部渐隐，全文在展开面板里 */}
      <div className={s.cPrompt}>
        <div className={s.promptClamp}>
          <PromptSections text={shot.imagePrompt} />
        </div>
      </div>
      <div className={s.cPrompt}>
        <div className={s.promptClamp}>
          <PromptSections text={shot.videoPrompt} />
        </div>
      </div>
    </div>
  )
}
