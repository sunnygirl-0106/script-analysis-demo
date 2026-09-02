import { useState } from 'react'
import { useStore } from '../store/useStore'
import { PHASES } from '../services/taskRun'
import { TaskProgress } from './TaskProgress'
import ui from '../styles/ui.module.css'
import d from './ScriptImportDialog.module.css'
import rs from './ReplaceEpisodeDialog.module.css'

// 补充剧本（v2.4 §3.4）。整理剧本页右上 ⋯ 的入口。
// 这是主线上仅剩的几个弹窗之一，理由正当：要用户提供东西（选文件）。
// 两拍：选文件 → 弹窗内 3 秒「整理中」。跑完关闭，新集出现在列表末尾、带「新增」角标、无锁。
// 这一步不提取资产、不收费——提取是整理剧本页页脚那一下。
const ORGANIZE_MS = 3000

export function SupplementScriptDialog({ onClose }: { onClose: () => void }) {
  const supplementScript = useStore((st) => st.supplementScript)
  const showToast = useStore((st) => st.showToast)
  const [srcTab, setSrcTab] = useState<'upload' | 'paste'>('upload')
  const [fileName, setFileName] = useState<string | null>(null)
  const [pasted, setPasted] = useState('')
  const [running, setRunning] = useState(false)

  const hasSrc = srcTab === 'upload' ? fileName != null : pasted.trim().length > 0

  const done = () => {
    supplementScript()
    onClose()
    showToast('已整理出 1 集（第 2 集），可提取资产。')
  }

  return (
    <div className={d.overlay} onClick={running ? undefined : onClose}>
      <div className={rs.dialog} onClick={(e) => e.stopPropagation()}>
        {running ? (
          <>
            <div className={d.title}>正在整理续集</div>
            <div style={{ marginTop: 8 }}>
              <TaskProgress phases={PHASES.appendParse} durationMs={ORGANIZE_MS} onDone={done} />
            </div>
          </>
        ) : (
          <>
            <div className={d.title}>补充剧本</div>
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
                onClick={() => setFileName('续集-第2集.docx')}
              >
                {fileName ? (
                  <>
                    <div className={rs.dropName}>已选择：{fileName}</div>
                    <div className={rs.dropHint}>点击可重新选择</div>
                  </>
                ) : (
                  <>
                    <div className={rs.dropName}>拖拽剧本文件到此处，或点击选择文件</div>
                    <div className={rs.dropHint}>支持 txt / docx / fdx</div>
                  </>
                )}
              </button>
            ) : (
              <textarea
                className={rs.paste}
                value={pasted}
                spellCheck={false}
                placeholder="粘贴续集剧本内容…"
                onChange={(e) => setPasted(e.target.value)}
              />
            )}
            <div className={rs.foot}>新的集会接在现有剧集之后，整理完成后再提取资产。</div>
            <div className={d.actions}>
              <button className={ui.btn} onClick={onClose}>取消</button>
              <button
                className={[ui.btn, ui.btnPrimary].join(' ')}
                disabled={!hasSrc}
                onClick={() => setRunning(true)}
              >
                开始整理
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
