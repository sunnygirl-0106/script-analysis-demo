import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
import { altScriptPayload } from '../data/seedAltScript'
import ui from '../styles/ui.module.css'
import s from './ScriptImportDialog.module.css'

type Mode = 'append' | 'overwrite'

interface Props {
  open: boolean
  defaultMode?: Mode
  onClose: () => void
}

// ★ 导入新剧本：分「追加到末尾 / 替换整个剧本」两条路。受控组件，供工具栏与集级菜单「追加剧集」复用。
// 「替换本集剧本」是另一条独立流程（见 ReplaceEpisodeDialog），不走这里。
export function ScriptImportDialog({ open, defaultMode = 'append', onClose }: Props) {
  const [mode, setMode] = useState<Mode>(defaultMode)
  const [step, setStep] = useState<1 | 2>(1)
  const [ack, setAck] = useState(false)

  const project = useStore((st) => st.project)
  const appendEpisode2 = useStore((st) => st.appendEpisode2)
  const replaceScript = useStore((st) => st.replaceScript)
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
    replaceScript(altScriptPayload)
    onClose()
  }

  return (
    <div className={s.overlay} onClick={onClose}>
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
                    现有 {counts.ep} 集 {counts.scene} 场 {counts.shot} 个镜头不会改变，新剧本会接在现有剧集之后，同名角色会自动沿用已有资料。
                    {hasEp2 && <span className={s.warnInline}>（第 2 集已加入过，将无变化）</span>}
                  </div>
                </div>
              </label>
              <label className={[s.opt, mode === 'overwrite' ? s.on : ''].join(' ')}>
                <input type="radio" checked={mode === 'overwrite'} onChange={() => setMode('overwrite')} />
                <div className={s.optBody}>
                  <div className={s.optHead}>替换整个剧本</div>
                  <div className={s.optDesc}>
                    当前的剧本分析内容将被替换。你修改过的镜头时长、提示词以及出场人物和物品将无法保留。
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
            <div className={s.title}>确定替换整个剧本？</div>
            <div className={s.danger}>
              ⚠️ 新剧本《{altScriptPayload.title}》将替换当前剧本及全部分析内容。你此前的修改在替换后将无法恢复。
            </div>
            <label className={s.ackRow}>
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
              <span>
                我已了解：当前 <b>{counts.ep} 集 / {counts.scene} 场 / {counts.shot} 个镜头 / {counts.asset} 项相关素材</b> 将被替换
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
                替换剧本
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
