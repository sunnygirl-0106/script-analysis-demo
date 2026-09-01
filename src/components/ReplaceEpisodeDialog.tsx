import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import type { CandidateDecision } from '../data/types'
import { episode2Payload } from '../data/seedEpisode2'
import { RATE, costParse, fmtCost } from '../services/cost'
import { PHASES, taskDuration } from '../services/taskRun'
import { TaskProgress } from './TaskProgress'
import { AssetPrecheck, applyDecisions, type Decision } from './AssetPrecheck'
import ui from '../styles/ui.module.css'
import di from './ScriptImportDialog.module.css'
import s from './ReplaceEpisodeDialog.module.css'

type Tab = 'upload' | 'paste'
type Step = 'input' | 'parsing' | 'confirm' | 'applying'

const EP2_TEXT = Object.values(episode2Payload.scenes).map((sc) => sc.rawText).join('\n')
const EP2_SCENES = Object.keys(episode2Payload.scenes).length
const EP2_SHOTS = Object.keys(episode2Payload.shots).length
const PARSE_COST = Math.max(costParse(EP2_TEXT), Math.round((EP2_SCENES * 2400) / 1000) * RATE.parsePerKChar)
const APPLY_COST = EP2_SHOTS * RATE.shot

// ★ 替换本集剧本（两段式，§4.4③）：原文用户当场给，必须先付费解析才知道有哪些新资产。
// 第一段选/粘贴 → 解析并检查（中间一次有决策价值的停顿）→ 第二段预检查 + 消耗 → 确认替换。
export function ReplaceEpisodeDialog({ episodeId, onClose }: { episodeId: string; onClose: () => void }) {
  const project = useStore((st) => st.project)
  const previewCandidates = useStore((st) => st.previewCandidates)
  const scannedForEp2 = useStore((st) => st.scannedForEp2)
  const commitScanned = useStore((st) => st.commitScanned)
  const runReplaceEpisode = useStore((st) => st.runReplaceEpisode)

  const ep = project.episodes.find((e) => e.id === episodeId)
  const no = ep?.no ?? 0
  const curScenes = ep ? ep.sceneIds.length : 0
  const curShots = ep ? ep.sceneIds.reduce((n, id) => n + (project.scenes[id]?.shotIds.length ?? 0), 0) : 0

  const [tab, setTab] = useState<Tab>('upload')
  const [step, setStep] = useState<Step>('input')
  const [fileName, setFileName] = useState<string | null>(null)
  const [pasted, setPasted] = useState('')
  const [decisions, setDecisions] = useState<Record<string, Decision>>({})

  const cands = useMemo(() => previewCandidates(scannedForEp2()), [previewCandidates, scannedForEp2, project.assets])

  if (!ep) return null

  const hasInput = tab === 'upload' ? fileName != null : pasted.trim().length > 0
  const running = step === 'parsing' || step === 'applying'
  const overlayClose = running ? undefined : onClose

  const applyDone = () => {
    commitScanned(applyDecisions(cands, decisions))
    runReplaceEpisode(episodeId)
    onClose()
  }

  return (
    <div className={di.overlay} onClick={overlayClose}>
      <div className={s.dialog} onClick={(e) => e.stopPropagation()}>
        {step === 'input' && (
          <>
            <div className={di.title}>替换第 {no} 集剧本</div>
            <div className={s.sub}>上传新的剧本内容，解析后替换当前第 {no} 集。其他剧集不受影响。</div>
            <div className={s.tabs}>
              <button className={[s.tab, tab === 'upload' ? s.tabOn : ''].join(' ')} onClick={() => setTab('upload')}>上传文件</button>
              <button className={[s.tab, tab === 'paste' ? s.tabOn : ''].join(' ')} onClick={() => setTab('paste')}>粘贴文本</button>
            </div>
            {tab === 'upload' ? (
              <button className={[s.drop, fileName ? s.dropOn : ''].join(' ')} onClick={() => setFileName(`第${no}集-修订版.docx`)}>
                {fileName ? (
                  <><div className={s.dropName}>已选择：{fileName}</div><div className={s.dropHint}>点击可重新选择</div></>
                ) : (
                  <><div className={s.dropName}>拖拽剧本文件到此处，或点击选择文件</div><div className={s.dropHint}>支持 .docx / .txt / .md</div></>
                )}
              </button>
            ) : (
              <textarea className={s.paste} value={pasted} spellCheck={false} placeholder="粘贴新的剧本内容…" onChange={(e) => setPasted(e.target.value)} />
            )}
            <div className={s.foot}>需先解析新原文，才能知道有哪些尚未收录的资产。本操作仅替换第 {no} 集。</div>
            <div className={di.actions}>
              <button className={ui.btn} onClick={onClose}>取消</button>
              <button className={[ui.btn, ui.btnPrimary].join(' ')} disabled={!hasInput} onClick={() => setStep('parsing')}>
                解析并检查 · {fmtCost(PARSE_COST)}
              </button>
            </div>
          </>
        )}

        {step === 'parsing' && (
          <>
            <div className={di.title}>正在解析第 {no} 集</div>
            <div style={{ marginTop: 8 }}>
              <TaskProgress phases={PHASES.appendParse} durationMs={taskDuration(PARSE_COST)} onDone={() => setStep('confirm')} />
            </div>
          </>
        )}

        {step === 'confirm' && (
          <>
            <div className={di.title}>确认替换第 {no} 集</div>
            <div className={s.meta}>✓ 已解析：{EP2_SCENES} 场 · {EP2_SHOTS} 镜</div>
            <div className={s.compare}>当前：{curScenes} 场 · {curShots} 个镜头　→　新内容：{EP2_SCENES} 场 · {EP2_SHOTS} 个镜头</div>
            <AssetPrecheck
              cands={cands}
              assets={project.assets}
              decisions={decisions}
              onChange={(id, dec, link) => setDecisions((m) => ({ ...m, [id]: { decision: dec as CandidateDecision, linkTargetId: link } }))}
              applySummary={
                <>
                  第 {no} 集当前 {curScenes} 场、{curShots} 个镜头及其中手动修改将被新结果替换；仅在本集出现、新剧本不再使用的素材将变为未引用（不删除）。其他剧集不受影响，此操作不可撤销。
                </>
              }
            />
            <div className={s.meta} style={{ marginTop: 12 }}>
              解析已消耗 {fmtCost(PARSE_COST)}，本次还将消耗 {fmtCost(APPLY_COST)}。
            </div>
            <div className={s.foot}>取消则已解析的 {fmtCost(PARSE_COST)} 不退，剩余不扣。</div>
            <div className={di.actions}>
              <button className={ui.btn} onClick={onClose}>取消</button>
              <button className={[ui.btn, ui.btnPrimary].join(' ')} onClick={() => setStep('applying')}>
                确认并替换本集 · {fmtCost(APPLY_COST)}
              </button>
            </div>
          </>
        )}

        {step === 'applying' && (
          <>
            <div className={di.title}>正在替换第 {no} 集</div>
            <div style={{ marginTop: 8 }}>
              <TaskProgress phases={PHASES.replaceEp} durationMs={taskDuration(APPLY_COST)} onDone={applyDone} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
