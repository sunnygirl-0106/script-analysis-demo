import type { MouseEvent } from 'react'
import { useStore } from '../store/useStore'
import type { AssetKind, Costume, MountRef, Shot } from '../data/types'
import { chipClass, KIND_LABEL } from './entity'
import { MountPicker } from './MountPicker'
import { PromptSections } from './PromptSections'
import ui from '../styles/ui.module.css'
import s from './Storyboard.module.css'

const KINDS: AssetKind[] = ['character', 'costume', 'location', 'prop']

function fmt(sec: number): string {
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`
}

interface Props {
  shot: Shot
  startAt: number
  endAt: number
  active: boolean
  readOnly: boolean
  onHover: (id: string | null) => void
}

export function ShotRow({ shot, startAt, endAt, active, readOnly, onHover }: Props) {
  const assets = useStore((st) => st.project.assets)
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

  // 关联资产分组：角色带服装小字，服装（游离）/场景/道具走标签行。
  const characters = shot.mounts.filter((m) => m.kind === 'character')
  const mountedCostumeIds = new Set(shot.mounts.filter((m) => m.kind === 'costume').map((m) => m.assetId))
  const costumeOwner = (charId: string) =>
    [...mountedCostumeIds]
      .map((id) => assets[id] as Costume | undefined)
      .filter((c): c is Costume => !!c && c.characterId === charId)
      .map((c) => c.name)
  const ownedCostumeIds = new Set(
    characters.flatMap((m) =>
      [...mountedCostumeIds].filter((cid) => (assets[cid] as Costume | undefined)?.characterId === m.assetId),
    ),
  )
  const orphanCostumes = shot.mounts.filter((m) => m.kind === 'costume' && !ownedCostumeIds.has(m.assetId))
  const rows = (
    [
      { label: KIND_LABEL.costume, kind: 'costume', items: orphanCostumes },
      { label: KIND_LABEL.location, kind: 'location', items: shot.mounts.filter((m) => m.kind === 'location') },
      { label: KIND_LABEL.prop, kind: 'prop', items: shot.mounts.filter((m) => m.kind === 'prop') },
    ] as { label: string; kind: AssetKind; items: MountRef[] }[]
  ).filter((r) => r.items.length > 0)

  const missing = KINDS.filter((k) => !shot.mounts.some((m) => m.kind === k)).map((k) => KIND_LABEL[k])

  return (
    <div
      className={[s.row, active ? s.rowOn : ''].join(' ')}
      onMouseEnter={() => onHover(shot.id)}
      onMouseLeave={() => onHover(null)}
    >
      {/* ① 镜号 · 时长 */}
      <div className={s.cNo}>
        <div className={[s.noPill, active ? s.noPillOn : ''].join(' ')}>
          {String(shot.no).padStart(2, '0')}
        </div>
        {readOnly ? (
          <div className={s.durStatic}>{shot.duration}s</div>
        ) : (
          <div className={[s.stepper, active ? s.stepperOn : ''].join(' ')}>
            <button className={s.stepBtn} onClick={(e) => step(e, -1)} title="减少 1s">
              −
            </button>
            <span className={s.durVal}>{shot.duration}s</span>
            <button className={s.stepBtn} onClick={(e) => step(e, 1)} title="增加 1s">
              +
            </button>
          </div>
        )}
        <div className={s.tcRange}>
          {fmt(startAt)} → {fmt(endAt)}
        </div>
      </div>

      {/* ② 关联资产 */}
      <div className={s.cAsset}>
        <div className={s.assetStack}>
          {characters.map((m) => {
            const name = nameOf(m)
            const wardrobe = costumeOwner(m.assetId)
            return (
              <div className={s.cast} key={m.assetId}>
                <span className={s.avatar}>{name.slice(0, 1)}</span>
                <span className={s.castMeta}>
                  <span className={s.castName}>{name}</span>
                  <span className={s.castCostume}>{wardrobe.length ? wardrobe.join(' · ') : '未指定服装'}</span>
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
            {missing.length > 0 && <span className={s.missing}>缺 {missing.join(' / ')}</span>}
          </div>
        </div>
      </div>

      {/* ③ 镜头：景别 / 焦段 / 光影 / 运镜 + 对白 · 音效 */}
      <div className={s.cShot}>
        <div className={s.shotTitle}>{shot.title}</div>
        <div className={s.tagRow}>
          <span className={s.tag}>
            <span className={s.tagKey}>景别</span>
            {shot.shotSize}
          </span>
          <span className={s.tag}>
            <span className={s.tagKey}>焦段</span>
            {shot.lens}
          </span>
          <span className={s.tag}>
            <span className={s.tagKey}>光影</span>
            {shot.lighting}
          </span>
          <span className={s.tag}>
            <span className={s.tagKey}>运镜</span>
            {shot.cameraMove}
          </span>
        </div>
        <div className={s.audioLine}>
          对白 · {shot.dialogue}　音效 · {shot.sfx}
        </div>
      </div>

      {/* ④ 画面提示词（整段） */}
      <div className={s.cPrompt}>
        <PromptSections text={shot.imagePrompt} flow />
      </div>

      {/* ⑤ 视频提示词（整段，运镜/对白/音效已在镜头列，正文只留旁白） */}
      <div className={s.cPrompt}>
        <PromptSections text={shot.videoPrompt} flow dropTags={['运镜', '对白', '音效']} />
      </div>
    </div>
  )
}
