import { useState } from 'react'
import { Dialog } from './Dialog'
import { useStore } from '../store/useStore'
import { PHASES } from '../services/taskRun'
import { TaskProgress } from './TaskProgress'
import ui from '../styles/ui.module.css'
import d from '../styles/dialog.module.css'
import rs from './ScriptSourceDialog.module.css'

// 选剧本来源的弹窗（v2.5 §5.1）。两处入口共用一个组件，只换文案与收尾动作：
//   first      —— 空态 hero 的「＋ 上传剧本」。上传必须是一个**真实的选文件动作**，
//                 所以这一步是弹窗而不是直接开跑：点「开始整理」关窗，交给整页动效。
//   supplement —— 整理剧本页 ⋯ 的「上传文件 · 解析新集」。它在弹窗内跑完 3 秒进度，
//                 因为这一下不跨步骤（还在第①步），不值得一整页动效。
//
// 弹窗是主线上仅剩的几个之一，理由正当：要用户提供东西（选文件 / 粘贴）。
const ORGANIZE_MS = 3000

type Mode = 'first' | 'supplement'

const COPY: Record<Mode, {
  title: string
  file: string
  paste: string
  foot?: string
  cta: string
}> = {
  first: {
    title: '上传剧本',
    file: '最后的尊严-剧本.docx',
    paste: '粘贴剧本全文…',
    cta: '开始整理',
  },
  supplement: {
    title: '上传文件 · 解析新集',
    file: '续集-第3集.docx',
    paste: '粘贴新集剧本…',
    foot: '新的集会接在现有剧集之后，整理完成后再提取资产。',
    cta: '解析新集',
  },
}

export function ScriptSourceDialog({ mode, onClose }: { mode: Mode; onClose: () => void }) {
  const beginOrganize = useStore((st) => st.beginOrganize)
  const supplementScript = useStore((st) => st.supplementScript)
  const showToast = useStore((st) => st.showToast)
  const [srcTab, setSrcTab] = useState<'upload' | 'paste'>('upload')
  const [fileName, setFileName] = useState<string | null>(null)
  const [pasted, setPasted] = useState('')
  const [running, setRunning] = useState(false)

  const c = COPY[mode]
  const hasSrc = srcTab === 'upload' ? fileName != null : pasted.trim().length > 0

  // first：关窗 → 整页动效接手（集数与字数是动效期间才算出来的，这里一个数都不许报）。
  // supplement：弹窗内跑 3 秒 → 新集落到列表末尾。
  const start = () => {
    if (mode === 'first') {
      onClose()
      beginOrganize()
    } else {
      setRunning(true)
    }
  }

  const supplementDone = () => {
    supplementScript()
    onClose()
    showToast('已整理出 1 集（第 3 集），可提取资产。')
  }

  return (
    <Dialog
      onClose={onClose}
      dismissible={!running}
      className={rs.dialog}
    >
      {running ? (
        <>
          <div className={d.title}>正在整理新集</div>
          <div style={{ marginTop: 8 }}>
            <TaskProgress phases={PHASES.appendParse} durationMs={ORGANIZE_MS} onDone={supplementDone} />
          </div>
        </>
      ) : (
        <>
          <div className={d.title}>{c.title}</div>
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
              onClick={() => setFileName(c.file)}
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
              placeholder={c.paste}
              onChange={(e) => setPasted(e.target.value)}
            />
          )}
          {c.foot && <div className={rs.foot}>{c.foot}</div>}
          <div className={d.actions}>
            <button className={ui.btn} onClick={onClose}>取消</button>
            <button
              className={[ui.btn, ui.btnPrimary].join(' ')}
              disabled={!hasSrc}
              onClick={start}
            >
              {c.cta}
            </button>
          </div>
        </>
      )}
    </Dialog>
  )
}
