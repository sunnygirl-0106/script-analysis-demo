import { useState } from 'react'
import { useStore } from '../store/useStore'
import { altScriptPayload } from '../data/seedAltScript'
import ui from '../styles/ui.module.css'
import s from './ScriptImportDialog.module.css'

type Mode = 'append' | 'overwrite'

// ★ 导入剧本：分「追加到末尾 / 覆盖重来」两条路。覆盖是危险操作，需二次确认。
export function ScriptImportDialog({ disabled }: { disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('append')
  const [step, setStep] = useState<1 | 2>(1)
  const [ack, setAck] = useState(false)

  const project = useStore((st) => st.project)
  const appendEpisode2 = useStore((st) => st.appendEpisode2)
  const replaceScript = useStore((st) => st.replaceScript)
  const hasEp2 = project.episodes.some((e) => e.id === 'e2')

  const counts = {
    ep: project.episodes.length,
    scene: Object.keys(project.scenes).length,
    shot: Object.keys(project.shots).length,
    asset: Object.keys(project.assets).length,
  }

  const close = () => {
    setOpen(false)
    setStep(1)
    setMode('append')
    setAck(false)
  }

  const onNext = () => {
    if (mode === 'append') {
      appendEpisode2()
      close()
    } else {
      setStep(2)
    }
  }

  const onConfirmOverwrite = () => {
    replaceScript(altScriptPayload)
    close()
  }

  return (
    <>
      <button className={ui.btn} disabled={disabled} onClick={() => setOpen(true)}>
        导入剧本
      </button>
      {open && (
        <div className={s.overlay} onClick={close}>
          <div className={s.dialog} onClick={(e) => e.stopPropagation()}>
            {step === 1 ? (
              <>
                <div className={s.title}>导入新剧本</div>
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
                      <div className={s.optHead}>覆盖重来</div>
                      <div className={s.optDesc}>
                        丢弃当前全部解析结果，用新剧本重新开始。已手改的时长、提示词、挂载不可恢复。
                      </div>
                    </div>
                  </label>
                </div>
                <div className={s.actions}>
                  <button className={ui.btn} onClick={close}>
                    取消
                  </button>
                  <button className={[ui.btn, ui.btnPrimary].join(' ')} onClick={onNext}>
                    下一步
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className={s.title}>确认覆盖重来</div>
                <div className={s.danger}>
                  ⚠️ 这是危险操作。当前项目的全部解析结果将被新剧本《{altScriptPayload.title}》整体替换，且不可恢复。
                </div>
                <label className={s.ackRow}>
                  <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
                  <span>
                    我知道将丢失 <b>{counts.ep} 集 / {counts.scene} 场 / {counts.shot} 镜 / {counts.asset} 项资产</b>
                  </span>
                </label>
                <div className={s.actions}>
                  <button className={ui.btn} onClick={() => setStep(1)}>
                    返回
                  </button>
                  <button
                    className={[ui.btn, ui.btnDanger].join(' ')}
                    disabled={!ack}
                    onClick={onConfirmOverwrite}
                  >
                    覆盖重来
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
