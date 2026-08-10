import { Fragment } from 'react'
import { useStore } from '../store/useStore'
import type { AssetKind, MountRef, Shot } from '../data/types'
import { chipClass } from './entity'
import { MountPicker } from './MountPicker'
import { DurationInput } from './DurationInput'
import { ShotDetail } from './ShotDetail'
import ui from '../styles/ui.module.css'
import s from './Storyboard.module.css'

// 资产分三组对齐：角色（含服装）/ 场景 / 道具。
const GROUPS: { label: string; kinds: AssetKind[] }[] = [
  { label: '角色', kinds: ['character', 'costume'] },
  { label: '场景', kinds: ['location'] },
  { label: '道具', kinds: ['prop'] },
]

interface Props {
  shot: Shot
  expanded: boolean
  viewMode: 'brief' | 'dual'
  readOnly: boolean
}

export function ShotRow({ shot, expanded, viewMode, readOnly }: Props) {
  const assets = useStore((st) => st.project.assets)
  const toggleShot = useStore((st) => st.toggleShot)
  const removeMount = useStore((st) => st.removeMount)

  const nameOf = (m: MountRef) => assets[m.assetId]?.name ?? '（已删除）'
  const metaDialogue = shot.dialogue === '无' ? '无台词' : `台词 ${shot.dialogue}`

  return (
    <Fragment>
      <tr className={[s.row, expanded ? s.on : ''].join(' ')} onClick={() => toggleShot(shot.id)}>
        <td>
          <div className={s.num}>
            {shot.no}
            <s>{shot.shotSize}</s>
          </div>
        </td>
        <td onClick={(e) => e.stopPropagation()}>
          {GROUPS.map((g) => {
            const items = shot.mounts.filter((m) => g.kinds.includes(m.kind))
            return (
              <div className={s.ag} key={g.label}>
                <span className={s.k}>{g.label}</span>
                <span className={s.v}>
                  {items.map((m) => (
                    <span
                      key={m.assetId}
                      className={[ui.chip, chipClass(m.kind), readOnly ? '' : ui.chipRemovable].join(' ')}
                      onClick={() => !readOnly && removeMount(shot.id, m.assetId)}
                      title={readOnly ? '' : '点击移除'}
                    >
                      <span className={ui.odot} />
                      {nameOf(m)}
                    </span>
                  ))}
                  <MountPicker shotId={shot.id} kinds={g.kinds} mounts={shot.mounts} disabled={readOnly} />
                </span>
              </div>
            )
          })}
        </td>
        <td>
          {viewMode === 'brief' ? (
            <div className={s.brief}>
              <div className={s.ttl}>{shot.title}</div>
              <div className={s.meta}>
                {shot.lens} · {shot.lighting} · <em>{shot.cameraMove}</em> · {metaDialogue}
              </div>
              <div className={[s.desc, s.l2].join(' ')}>{shot.imagePrompt}</div>
            </div>
          ) : (
            <div className={s.dual}>
              <div>
                <div className={s.dualLab}>画面</div>
                <div className={[s.desc, s.l3].join(' ')}>{shot.imagePrompt}</div>
              </div>
              <div>
                <div className={s.dualLab}>视频</div>
                <div className={[s.desc, s.l3].join(' ')}>{shot.videoPrompt}</div>
              </div>
            </div>
          )}
        </td>
        <td onClick={(e) => e.stopPropagation()}>
          <DurationInput
            shotId={shot.id}
            duration={shot.duration}
            why={shot.dialogue === '无' ? '无台词 · 按动作' : '含台词 · 留白'}
            readOnly={readOnly}
          />
        </td>
      </tr>
      <tr className={[s.det, expanded ? s.on : s.empty].join(' ')}>
        <td colSpan={4}>{expanded && <ShotDetail shot={shot} />}</td>
      </tr>
    </Fragment>
  )
}
