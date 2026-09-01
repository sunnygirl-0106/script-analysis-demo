import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import type { CandidateDecision } from '../data/types'
import { altScriptPayload } from '../data/seedAltScript'
import { episode2Payload } from '../data/seedEpisode2'
import { RATE, costParse, fmtCost } from '../services/cost'
import { PHASES, taskDuration } from '../services/taskRun'
import { TaskProgress } from './TaskProgress'
import { AssetPrecheck, applyDecisions, type Decision } from './AssetPrecheck'
import ui from '../styles/ui.module.css'
import s from './ScriptImportDialog.module.css'
import rs from './ReplaceEpisodeDialog.module.css'

type Mode = 'append' | 'overwrite'
// append 两段：选源 → 解析 → 确认(含预检查) → 落库；overwrite 保留原有整本替换流程。
type Step = 'mode' | 'aSource' | 'aParsing' | 'aConfirm' | 'aApplying' | 'oUpload' | 'oConfirm'

interface Props {
  open: boolean
  defaultMode?: Mode
  onClose: () => void
}

const EP2_TEXT = Object.values(episode2Payload.scenes).map((sc) => sc.rawText).join('\n')
const EP2_SCENES = Object.keys(episode2Payload.scenes).length
const EP2_SHOTS = Object.keys(episode2Payload.shots).length
// 演示原文很短，给解析一个不至于是 ✦1 的代表性字数，让「先付费解析」这一步有质感。
const PARSE_COST = Math.max(costParse(EP2_TEXT), Math.round((EP2_SCENES * 2400) / 1000) * RATE.parsePerKChar)
const APPLY_COST = EP2_SHOTS * RATE.shot

// ★ 导入新剧本：追加续集（两段式，§4.4④）或替换整个剧本。受控组件，供工具栏与集级菜单「追加剧集」复用。
export function ScriptImportDialog({ open, defaultMode = 'append', onClose }: Props) {
  const [mode, setMode] = useState<Mode>(defaultMode)
  const [step, setStep] = useState<Step>('mode')
  const [ack, setAck] = useState(false)
  const [srcTab, setSrcTab] = useState<'upload' | 'paste'>('upload')
  const [fileName, setFileName] = useState<string | null>(null)
  const [pasted, setPasted] = useState('')
  const [decisions, setDecisions] = useState<Record<string, Decision>>({})

  const project = useStore((st) => st.project)
  const replaceScript = useStore((st) => st.replaceScript)
  const previewCandidates = useStore((st) => st.previewCandidates)
  const scannedForEp2 = useStore((st) => st.scannedForEp2)
  const commitScanned = useStore((st) => st.commitScanned)
  const runAppendEpisode = useStore((st) => st.runAppendEpisode)
  const hasEp2 = project.episodes.some((e) => e.id === 'e2')

  const cands = useMemo(() => previewCandidates(scannedForEp2()), [previewCandidates, scannedForEp2, project.assets])

  useEffect(() => {
    if (open) {
      setMode(defaultMode)
      setStep('mode')
      setAck(false)
      setSrcTab('upload')
      setFileName(null)
      setPasted('')
      setDecisions({})
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

  const onNext = () => setStep(mode === 'append' ? 'aSource' : 'oUpload')
  const onConfirmOverwrite = () => { replaceScript(altScriptPayload); onClose() }

  const applyDone = () => {
    commitScanned(applyDecisions(cands, decisions))
    runAppendEpisode()
    onClose()
  }

  const running = step === 'aParsing' || step === 'aApplying'

  return (
    <div className={s.overlay} onClick={running ? undefined : onClose}>
      <div className={s.dialog} onClick={(e) => e.stopPropagation()}>
        {step === 'mode' && (
          <>
            <div className={s.title}>导入新剧本</div>
            <div className={s.options}>
              <label className={[s.opt, mode === 'append' ? s.on : ''].join(' ')}>
                <input type="radio" checked={mode === 'append'} onChange={() => setMode('append')} />
                <div className={s.optBody}>
                  <div className={s.optHead}>追加到末尾 <span className={s.rec}>推荐</span></div>
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
                  <div className={s.optDesc}>当前的剧本分析内容将被整个替换。下一步可上传或粘贴新剧本；替换后不可撤销。</div>
                </div>
              </label>
            </div>
            <div className={s.actions}>
              <button className={ui.btn} onClick={onClose}>取消</button>
              <button className={[ui.btn, ui.btnPrimary].join(' ')} onClick={onNext}>下一步</button>
            </div>
          </>
        )}

        {/* append 第一段：选 / 粘贴续集剧本 → 解析并检查 */}
        {step === 'aSource' && (
          <>
            <div className={s.title}>选择续集剧本</div>
            <div className={rs.tabs}>
              <button className={[rs.tab, srcTab === 'upload' ? rs.tabOn : ''].join(' ')} onClick={() => setSrcTab('upload')}>上传文件</button>
              <button className={[rs.tab, srcTab === 'paste' ? rs.tabOn : ''].join(' ')} onClick={() => setSrcTab('paste')}>粘贴文本</button>
            </div>
            {srcTab === 'upload' ? (
              <button className={[rs.drop, fileName ? rs.dropOn : ''].join(' ')} onClick={() => setFileName('续集-第2集.docx')}>
                {fileName ? (
                  <><div className={rs.dropName}>已选择：{fileName}</div><div className={rs.dropHint}>点击可重新选择</div></>
                ) : (
                  <><div className={rs.dropName}>拖拽剧本文件到此处，或点击选择文件</div><div className={rs.dropHint}>支持 .docx / .txt / .md</div></>
                )}
              </button>
            ) : (
              <textarea className={rs.paste} value={pasted} spellCheck={false} placeholder="粘贴续集剧本内容…" onChange={(e) => setPasted(e.target.value)} />
            )}
            <div className={rs.foot}>续集将接在现有剧集之后。需先解析原文，才能知道有哪些尚未收录的资产。</div>
            <div className={s.actions}>
              <button className={ui.btn} onClick={() => setStep('mode')}>返回</button>
              <button className={[ui.btn, ui.btnPrimary].join(' ')} disabled={!hasSrc} onClick={() => setStep('aParsing')}>
                解析并检查 · {fmtCost(PARSE_COST)}
              </button>
            </div>
          </>
        )}

        {step === 'aParsing' && (
          <>
            <div className={s.title}>正在解析续集</div>
            <div style={{ marginTop: 8 }}>
              <TaskProgress phases={PHASES.appendParse} durationMs={taskDuration(PARSE_COST)} onDone={() => setStep('aConfirm')} />
            </div>
          </>
        )}

        {/* append 第二段：已解析 → 预检查 + 消耗 → 确认并添加续集 */}
        {step === 'aConfirm' && (
          <>
            <div className={s.title}>添加续集</div>
            <div className={rs.meta}>✓ 已解析：{EP2_SCENES} 场</div>
            <AssetPrecheck
              cands={cands}
              assets={project.assets}
              decisions={decisions}
              onChange={(id, dec, link) => setDecisions((m) => ({ ...m, [id]: { decision: dec as CandidateDecision, linkTargetId: link } }))}
              applySummary={<>本次将把续集接在现有剧集之后并拆分其镜头。已有资产及图片不会被覆盖，其他集不受影响。</>}
            />
            <div className={rs.meta} style={{ marginTop: 12 }}>
              解析已消耗 {fmtCost(PARSE_COST)}，本次还将消耗 {fmtCost(APPLY_COST)}（生成 {EP2_SHOTS} 镜）。
            </div>
            <div className={rs.foot}>取消则已解析的 {fmtCost(PARSE_COST)} 不退，剩余不扣。</div>
            <div className={s.actions}>
              <button className={ui.btn} onClick={onClose}>取消</button>
              <button className={[ui.btn, ui.btnPrimary].join(' ')} onClick={() => setStep('aApplying')}>
                确认并添加续集 · {fmtCost(APPLY_COST)}
              </button>
            </div>
          </>
        )}

        {step === 'aApplying' && (
          <>
            <div className={s.title}>正在添加续集</div>
            <div style={{ marginTop: 8 }}>
              <TaskProgress phases={PHASES.appendApply} durationMs={taskDuration(APPLY_COST)} onDone={applyDone} />
            </div>
          </>
        )}

        {/* overwrite：整本替换（保留原有流程） */}
        {step === 'oUpload' && (
          <>
            <div className={s.title}>提供新剧本内容</div>
            <div className={rs.tabs}>
              <button className={[rs.tab, srcTab === 'upload' ? rs.tabOn : ''].join(' ')} onClick={() => setSrcTab('upload')}>上传文件</button>
              <button className={[rs.tab, srcTab === 'paste' ? rs.tabOn : ''].join(' ')} onClick={() => setSrcTab('paste')}>粘贴文本</button>
            </div>
            {srcTab === 'upload' ? (
              <button className={[rs.drop, fileName ? rs.dropOn : ''].join(' ')} onClick={() => setFileName('新剧本-完整版.docx')}>
                {fileName ? (
                  <><div className={rs.dropName}>已选择：{fileName}</div><div className={rs.dropHint}>点击可重新选择</div></>
                ) : (
                  <><div className={rs.dropName}>拖拽剧本文件到此处，或点击选择文件</div><div className={rs.dropHint}>支持 .docx / .txt / .md</div></>
                )}
              </button>
            ) : (
              <textarea className={rs.paste} value={pasted} spellCheck={false} placeholder="粘贴新的剧本内容…" onChange={(e) => setPasted(e.target.value)} />
            )}
            <div className={rs.foot}>上传或粘贴的内容将替换当前整个剧本；如包含多集，会一并替换。</div>
            <div className={s.actions}>
              <button className={ui.btn} onClick={onClose}>取消</button>
              <button className={[ui.btn, ui.btnPrimary].join(' ')} disabled={!hasSrc} onClick={() => setStep('oConfirm')}>下一步</button>
            </div>
          </>
        )}

        {step === 'oConfirm' && (
          <>
            <div className={s.title}>确定替换整个剧本？</div>
            <div className={s.danger}>⚠️ 新剧本《{altScriptPayload.title}》将替换当前剧本及全部分析结果。此操作不可撤销。</div>
            <label className={s.ackRow}>
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
              <span>我已了解：当前 <b>{counts.ep} 集 / {counts.scene} 场 / {counts.shot} 个镜头 / {counts.asset} 项相关素材</b> 将被替换</span>
            </label>
            <div className={s.actions}>
              <button className={ui.btn} onClick={() => setStep('oUpload')}>返回</button>
              <button className={[ui.btn, ui.btnDanger].join(' ')} disabled={!ack} onClick={onConfirmOverwrite}>替换剧本</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
