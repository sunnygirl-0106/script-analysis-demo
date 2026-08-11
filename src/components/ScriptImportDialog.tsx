import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
import { altScriptPayload } from '../data/seedAltScript'
import ui from '../styles/ui.module.css'
import s from './ScriptImportDialog.module.css'

type Mode = 'append' | 'overwrite'
type Scope = 'project' | 'episode'

interface Props {
  open: boolean
  defaultMode?: Mode
  scope?: Scope
  episodeId?: string
  onClose: () => void
}

// ★ 导入剧本：分「追加到末尾 / 覆盖重来」两条路。受控组件，供工具栏（全剧）与集级菜单（本集）复用。
// scope='episode' 时覆盖分支收窄为「替换本集」——语义诚实地实现为删除本集 + 追加新集。
export function ScriptImportDialog({ open, defaultMode = 'append', scope = 'project', episodeId, onClose }: Props) {
  const [mode, setMode] = useState<Mode>(defaultMode)
  const [step, setStep] = useState<1 | 2>(1)
  const [ack, setAck] = useState(false)

  const project = useStore((st) => st.project)
  const appendEpisode2 = useStore((st) => st.appendEpisode2)
  const replaceScript = useStore((st) => st.replaceScript)
  const replaceEpisode = useStore((st) => st.replaceEpisode)
  const hasEp2 = project.episodes.some((e) => e.id === 'e2')

  // 每次打开时按传入的默认值复位内部状态。
  useEffect(() => {
    if (open) {
      setMode(defaultMode)
      setStep(1)
      setAck(false)
    }
  }, [open, defaultMode])

  if (!open) return null

  const isEpisode = scope === 'episode'
  const targetEp = episodeId ? project.episodes.find((e) => e.id === episodeId) : undefined

  const counts = {
    ep: project.episodes.length,
    scene: Object.keys(project.scenes).length,
    shot: Object.keys(project.shots).length,
    asset: Object.keys(project.assets).length,
  }

  const onNext = () => {
    if (mode === 'append') {
      appendEpisode2()
      onClose()
    } else {
      setStep(2)
    }
  }

  const onConfirmOverwrite = () => {
    if (isEpisode && episodeId) replaceEpisode(episodeId)
    else replaceScript(altScriptPayload)
    onClose()
  }

  return (
    <div className={s.overlay} onClick={onClose}>
      <div className={s.dialog} onClick={(e) => e.stopPropagation()}>
        {step === 1 ? (
          <>
            <div className={s.title}>{isEpisode ? `重新导入 · 第 ${targetEp?.no ?? ''} 集` : '导入新剧本'}</div>
            <div className={s.options}>
              <label className={[s.opt, mode === 'append' ? s.on : ''].join(' ')}>
                <input type="radio" checked={mode === 'append'} onChange={() => setMode('append')} />
                <div className={s.optBody}>
                  <div className={s.optHead}>
                    追加到末尾 <span className={s.rec}>推荐</span>
                  </div>
                  <div className={s.optDesc}>
                    已有 {counts.ep} 集 {counts.scene} 场 {counts.shot} 镜保持不动，新集接在最后。老角色按名称复用，不重复建资产。
                    {hasEp2 && <span className={s.warnInline}>（第 2 集已追加过，将无变化）</span>}
                  </div>
                </div>
              </label>
              <label className={[s.opt, mode === 'overwrite' ? s.on : ''].join(' ')}>
                <input type="radio" checked={mode === 'overwrite'} onChange={() => setMode('overwrite')} />
                <div className={s.optBody}>
                  <div className={s.optHead}>{isEpisode ? '替换本集' : '覆盖重来'}</div>
                  <div className={s.optDesc}>
                    {isEpisode
                      ? `替换第 ${targetEp?.no ?? ''} 集的全部解析结果，其他集不受影响。实现为删除本集后按新剧本重新拆解。`
                      : '丢弃当前全部解析结果，用新剧本重新开始。已手改的时长、提示词、挂载不可恢复。'}
                  </div>
                </div>
              </label>
            </div>
            <div className={s.actions}>
              <button className={ui.btn} onClick={onClose}>
                取消
              </button>
              <button className={[ui.btn, ui.btnPrimary].join(' ')} onClick={onNext}>
                下一步
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={s.title}>{isEpisode ? `确认替换第 ${targetEp?.no ?? ''} 集` : '确认覆盖重来'}</div>
            <div className={s.danger}>
              {isEpisode ? (
                <>⚠️ 第 {targetEp?.no ?? ''} 集的全部解析结果将被删除，并按新剧本《{altScriptPayload.title}》重新拆解。其他集不受影响，此操作不可恢复。</>
              ) : (
                <>⚠️ 这是危险操作。当前项目的全部解析结果将被新剧本《{altScriptPayload.title}》整体替换，且不可恢复。</>
              )}
            </div>
            {!isEpisode && (
              <label className={s.ackRow}>
                <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
                <span>
                  我知道将丢失 <b>{counts.ep} 集 / {counts.scene} 场 / {counts.shot} 镜 / {counts.asset} 项资产</b>
                </span>
              </label>
            )}
            <div className={s.actions}>
              <button className={ui.btn} onClick={() => setStep(1)}>
                返回
              </button>
              <button
                className={[ui.btn, ui.btnDanger].join(' ')}
                disabled={!isEpisode && !ack}
                onClick={onConfirmOverwrite}
              >
                {isEpisode ? '替换本集' : '覆盖重来'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
