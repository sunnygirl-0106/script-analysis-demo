import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
import { altScriptPayload } from '../data/seedAltScript'
import ui from '../styles/ui.module.css'
import s from './ScriptImportDialog.module.css'
import rs from './ReplaceEpisodeDialog.module.css'

type Mode = 'append' | 'overwrite'
type Step = 'mode' | 'upload' | 'confirm'

interface Props {
  open: boolean
  defaultMode?: Mode
  onClose: () => void
}

// ★ 导入新剧本：分「追加到末尾 / 替换整个剧本」两条路。受控组件，供工具栏与集级菜单「追加剧集」复用。
// 「替换本集剧本」是另一条独立流程（见 ReplaceEpisodeDialog），不走这里。
// ⚠ demo 假数据：上传/粘贴均不接真实文件与拆解，内容恒为 altScriptPayload。
export function ScriptImportDialog({ open, defaultMode = 'append', onClose }: Props) {
  const [mode, setMode] = useState<Mode>(defaultMode)
  const [step, setStep] = useState<Step>('mode')
  const [ack, setAck] = useState(false)
  // 模拟上传：点上传区不打开系统文件选择器，直接置一个固定文件名；内容恒为 altScriptPayload。
  const [srcTab, setSrcTab] = useState<'upload' | 'paste'>('upload')
  const [fileName, setFileName] = useState<string | null>(null)
  const [pasted, setPasted] = useState('')

  const project = useStore((st) => st.project)
  const appendEpisode2 = useStore((st) => st.appendEpisode2)
  const replaceScript = useStore((st) => st.replaceScript)
  const hasEp2 = project.episodes.some((e) => e.id === 'e2')

  // 每次打开时按传入的默认值复位内部状态。
  useEffect(() => {
    if (open) {
      setMode(defaultMode)
      setStep('mode')
      setAck(false)
      setSrcTab('upload')
      setFileName(null)
      setPasted('')
    }
  }, [open, defaultMode])

  if (!open) return null

  const counts = {
    ep: project.episodes.length,
    scene: Object.keys(project.scenes).length,
    shot: Object.keys(project.shots).length,
    asset: Object.keys(project.assets).length,
  }

  const hasSrc = srcTab === 'upload' ? fileName != null : pasted.trim().length > 0

  const onNext = () => {
    if (mode === 'append') {
      appendEpisode2()
      onClose()
    } else {
      setStep('upload')
    }
  }

  const onConfirmOverwrite = () => {
    replaceScript(altScriptPayload)
    onClose()
  }

  return (
    <div className={s.overlay} onClick={onClose}>
      <div className={s.dialog} onClick={(e) => e.stopPropagation()}>
        {step === 'mode' && (
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
                    当前的剧本分析内容将被整个替换。下一步可上传或粘贴新剧本；替换后不可撤销。
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
        )}

        {step === 'upload' && (
          <>
            <div className={s.title}>提供新剧本内容</div>
            <div className={rs.tabs}>
              <button
                className={[rs.tab, srcTab === 'upload' ? rs.tabOn : ''].join(' ')}
                onClick={() => setSrcTab('upload')}
              >
                上传文件
              </button>
              <button
                className={[rs.tab, srcTab === 'paste' ? rs.tabOn : ''].join(' ')}
                onClick={() => setSrcTab('paste')}
              >
                粘贴文本
              </button>
            </div>

            {srcTab === 'upload' ? (
              <button
                className={[rs.drop, fileName ? rs.dropOn : ''].join(' ')}
                onClick={() => setFileName('新剧本-完整版.docx')}
              >
                {fileName ? (
                  <>
                    <div className={rs.dropName}>已选择：{fileName}</div>
                    <div className={rs.dropHint}>点击可重新选择</div>
                  </>
                ) : (
                  <>
                    <div className={rs.dropName}>拖拽剧本文件到此处，或点击选择文件</div>
                    <div className={rs.dropHint}>支持 .docx / .txt / .md</div>
                  </>
                )}
              </button>
            ) : (
              <textarea
                className={rs.paste}
                value={pasted}
                spellCheck={false}
                placeholder="粘贴新的剧本内容…"
                onChange={(e) => setPasted(e.target.value)}
              />
            )}

            <div className={rs.foot}>
              上传或粘贴的内容将替换当前整个剧本；如包含多集，会一并替换。
            </div>
            <div className={s.actions}>
              <button className={ui.btn} onClick={onClose}>
                取消
              </button>
              <button
                className={[ui.btn, ui.btnPrimary].join(' ')}
                disabled={!hasSrc}
                onClick={() => setStep('confirm')}
              >
                下一步
              </button>
            </div>
          </>
        )}

        {step === 'confirm' && (
          <>
            <div className={s.title}>确定替换整个剧本？</div>
            <div className={s.danger}>
              ⚠️ 新剧本《{altScriptPayload.title}》将替换当前剧本及全部分析结果。此操作不可撤销。
            </div>
            <label className={s.ackRow}>
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
              <span>
                我已了解：当前 <b>{counts.ep} 集 / {counts.scene} 场 / {counts.shot} 个镜头 / {counts.asset} 项相关素材</b> 将被替换
              </span>
            </label>
            <div className={s.actions}>
              <button className={ui.btn} onClick={() => setStep('upload')}>
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
