import { useState } from 'react'
import { useStore } from '../store/useStore'
import { episodeReplaceDiff } from '../services/replace'
import ui from '../styles/ui.module.css'
import di from './ScriptImportDialog.module.css'
import s from './ReplaceEpisodeDialog.module.css'

// 替换本集剧本：三态状态机 input → confirm → running（running 可落 failed）。
// ⚠ 全程为 demo 假数据，不接真实文件上传 / 真实拆解：
//   · 点上传区不打开系统文件选择器，直接模拟选中「第{no}集-修订版.docx」；
//   · 上传文件走单集分支（直接进 confirm）；粘贴文本走多集分支（先出多集选择器）；
//   · 「模拟拆解失败」是 demo 专用触发器，用极弱化的 demoHint 呈现；
//   · 落库沿用 store.replaceEpisode（内容恒为演示的「新集」），diff 数字在其前后各取一次 project。
// 关键约束：先拆解成功再落库，拆解期间原剧集内容不得有任何变化。
const MOCK_PARSE_MS = 1200

type Tab = 'upload' | 'paste'
type Step = 'input' | 'multi' | 'confirm' | 'running'

export function ReplaceEpisodeDialog({ episodeId, onClose }: { episodeId: string; onClose: () => void }) {
  const project = useStore((st) => st.project)
  const replaceEpisode = useStore((st) => st.replaceEpisode)
  const showToast = useStore((st) => st.showToast)

  const ep = project.episodes.find((e) => e.id === episodeId)
  const no = ep?.no ?? 0
  const curScenes = ep ? ep.sceneIds.length : 0
  const curShots = ep ? ep.sceneIds.reduce((n, id) => n + (project.scenes[id]?.shotIds.length ?? 0), 0) : 0

  const [tab, setTab] = useState<Tab>('upload')
  const [step, setStep] = useState<Step>('input')
  // 上传：模拟选中的文件名（点上传区即置上）。粘贴：文本框内容。
  const [fileName, setFileName] = useState<string | null>(null)
  const [pasted, setPasted] = useState('')
  const [multiPick, setMultiPick] = useState(0)
  const [failed, setFailed] = useState(false)

  if (!ep) return null

  // 演示：识别到的「新内容」概况。上传=单集；粘贴=多集（选一集）。
  const parsedScenes = tab === 'paste' ? [3, 4][multiPick] ?? 3 : 2
  const parsedShots = tab === 'paste' ? [8, 10][multiPick] ?? 8 : 5
  const srcName = tab === 'paste' ? `粘贴文本 · 第 ${multiPick + 1} 集` : (fileName ?? `第${no}集-修订版.docx`)

  const hasInput = tab === 'upload' ? fileName != null : pasted.trim().length > 0

  const pickFile = () => setFileName(`第${no}集-修订版.docx`)

  const onNextFromInput = () => {
    if (!hasInput) return
    // 上传=单集直接确认；粘贴=先出多集选择器。
    if (tab === 'paste') setStep('multi')
    else setStep('confirm')
  }

  const runParse = (simulateFail: boolean) => {
    setStep('running')
    setFailed(false)
    window.setTimeout(() => {
      if (simulateFail) {
        setFailed(true)
        return
      }
      // 先拆解成功，再落库：此刻才真正改动 project。
      const prev = useStore.getState().project
      replaceEpisode(episodeId)
      const next = useStore.getState().project
      // 演示只有一套「新集」内容，若 store 因守卫未落库（project 引用未变），
      // replaceEpisode 已弹出解释性 toast，这里直接关闭，不再叠加回执。
      if (next === prev) {
        onClose()
        return
      }
      const diff = episodeReplaceDiff(prev, next)
      // 回执数字取「实际落库的新集」，与树上保持一致。
      const newEp = next.episodes.find((e) => e.id === 'e2') ?? next.episodes[next.episodes.length - 1]
      const nScenes = newEp?.sceneIds.length ?? parsedScenes
      const nShots = newEp
        ? newEp.sceneIds.reduce((n, id) => n + (next.scenes[id]?.shotIds.length ?? 0), 0)
        : parsedShots
      showToast(
        `第 ${no} 集已替换为 ${nScenes} 场 ${nShots} 个镜头。沿用已有资产 ${diff.reused} 项，新增 ${diff.added} 项，移除 ${diff.removed} 项。`,
      )
      onClose()
    }, MOCK_PARSE_MS)
  }

  // running 态不可关闭、不可点遮罩。
  const overlayClose = step === 'running' ? undefined : onClose

  return (
    <div className={di.overlay} onClick={overlayClose}>
      <div className={s.dialog} onClick={(e) => e.stopPropagation()}>
        {step === 'input' && (
          <>
            <div className={di.title}>替换第 {no} 集剧本</div>
            <div className={s.sub}>上传新的剧本内容，重新拆解后替换当前第 {no} 集。其他剧集不受影响。</div>

            <div className={s.tabs}>
              <button className={[s.tab, tab === 'upload' ? s.tabOn : ''].join(' ')} onClick={() => setTab('upload')}>
                上传文件
              </button>
              <button className={[s.tab, tab === 'paste' ? s.tabOn : ''].join(' ')} onClick={() => setTab('paste')}>
                粘贴文本
              </button>
            </div>

            {tab === 'upload' ? (
              <button className={[s.drop, fileName ? s.dropOn : ''].join(' ')} onClick={pickFile}>
                {fileName ? (
                  <>
                    <div className={s.dropName}>已选择：{fileName}</div>
                    <div className={s.dropHint}>点击可重新选择</div>
                  </>
                ) : (
                  <>
                    <div className={s.dropName}>拖拽剧本文件到此处，或点击选择文件</div>
                    <div className={s.dropHint}>支持 .docx / .txt / .md</div>
                  </>
                )}
              </button>
            ) : (
              <textarea
                className={s.paste}
                value={pasted}
                spellCheck={false}
                placeholder="粘贴新的剧本内容…"
                onChange={(e) => setPasted(e.target.value)}
              />
            )}

            <div className={s.foot}>
              本操作仅替换第 {no} 集。若新内容包含多集，请改用工具栏的「导入新剧本」。
            </div>
            <div className={di.actions}>
              <button className={ui.btn} onClick={onClose}>
                取消
              </button>
              <button className={[ui.btn, ui.btnPrimary].join(' ')} disabled={!hasInput} onClick={onNextFromInput}>
                下一步
              </button>
            </div>
          </>
        )}

        {step === 'multi' && (
          <>
            <div className={di.title}>检测到 2 集内容，请选择用于替换第 {no} 集的剧集</div>
            <div className={s.pickList}>
              {[
                { no: 1, scenes: 3, chars: 2400 },
                { no: 2, scenes: 4, chars: 3100 },
              ].map((it, i) => (
                <label key={i} className={[s.pick, multiPick === i ? s.pickOn : ''].join(' ')}>
                  <input type="radio" checked={multiPick === i} onChange={() => setMultiPick(i)} />
                  <span>
                    第 {it.no} 集 · {it.scenes} 场 · 约 {it.chars} 字
                  </span>
                </label>
              ))}
            </div>
            <div className={di.actions}>
              <button className={ui.btn} onClick={() => setStep('input')}>
                返回
              </button>
              <button className={[ui.btn, ui.btnPrimary].join(' ')} onClick={() => setStep('confirm')}>
                下一步
              </button>
            </div>
          </>
        )}

        {step === 'confirm' && (
          <>
            <div className={di.title}>确认替换第 {no} 集</div>
            <div className={s.meta}>
              新内容：{srcName} · 识别到 {parsedScenes} 场 · 约 {parsedShots * 480} 字
            </div>
            <div className={s.compare}>
              当前：{curScenes} 场 · {curShots} 个镜头　→　新内容：{parsedScenes} 场 · {parsedShots} 个镜头
            </div>
            <div className={di.danger}>
              ⚠ 第 {no} 集当前的 {curScenes} 场、{curShots} 个镜头及其中的手动修改将被新的拆解结果替换。
              系统将优先匹配已有角色和资产；仅在本集出现、新剧本中不再使用的素材将被移除。
              其他剧集不受影响，此操作无法撤销。
            </div>
            <div className={di.actions}>
              <button className={ui.btn} onClick={() => setStep(tab === 'paste' ? 'multi' : 'input')}>
                返回修改
              </button>
              <button className={[ui.btn, ui.btnPrimary].join(' ')} onClick={() => runParse(false)}>
                替换并重新拆解
              </button>
            </div>
            {/* demo 专用触发器：极弱化，仅用于演示失败分支 */}
            <button className={s.demoHint} onClick={() => runParse(true)}>
              模拟拆解失败
            </button>
          </>
        )}

        {step === 'running' && !failed && (
          <>
            <div className={di.title}>正在拆解第 {no} 集</div>
            <div className={s.running}>
              <span className={s.spin} />
              正在拆解新剧本…原第 {no} 集内容暂未改动
            </div>
          </>
        )}

        {step === 'running' && failed && (
          <>
            <div className={di.title}>拆解失败</div>
            <div className={di.danger}>⚠ 新剧本拆解失败，原第 {no} 集未发生变化。</div>
            <div className={di.actions}>
              <button className={ui.btn} onClick={onClose}>
                取消
              </button>
              <button className={[ui.btn, ui.btnPrimary].join(' ')} onClick={() => runParse(false)}>
                重试
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
