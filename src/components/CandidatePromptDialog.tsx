import { useEffect, useRef, useState } from 'react'
import { TaskProgress } from './TaskProgress'
import { PHASES, taskDuration } from '../services/taskRun'
import { costAssetPrompt, fmtCost } from '../services/cost'
import ui from '../styles/ui.module.css'
import s from './CandidatePromptDialog.module.css'

// 阶段② 生成提示词的浮层（v2.3 §3.4）：点提示词 → 弹这个浮层盖在数据区上方，固定尺寸，
// 底下的数据行完全不动。取消 / 保存即走，Esc 关闭。空提示词给「✦ AI 结合剧本补全」。
export function CandidatePromptDialog({
  title,
  text,
  editable,
  onSave,
  onComplete,
  onClose,
}: {
  title: string
  text: string
  editable: boolean
  onSave: (v: string) => void
  onComplete?: () => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(text)
  const base = useRef(text)
  const [running, setRunning] = useState(false)

  // AI 补全把外部 text 从空写成草案：用户没手动改过时（draft 仍等于上一版外部值）同步进 draft。
  useEffect(() => {
    if (text !== base.current) {
      if (draft === base.current) setDraft(text)
      base.current = text
    }
  }, [text, draft])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const dirty = draft !== text
  const save = () => {
    onSave(draft)
    onClose()
  }
  const showComplete = editable && !!onComplete && !draft.trim()

  return (
    <div className={s.overlay} onClick={onClose}>
      <div className={s.pop} onClick={(e) => e.stopPropagation()}>
        <div className={s.head}>
          <span className={s.headName}>{title} · 生成提示词</span>
          <button className={s.close} onClick={onClose} title="关闭">✕</button>
        </div>

        <textarea
          className={s.textarea}
          value={draft}
          autoFocus
          readOnly={!editable}
          spellCheck={false}
          placeholder={editable ? '描述这条资产的画面（可留空，用下方 AI 补全生成草案）…' : ''}
          onChange={(e) => setDraft(e.target.value)}
        />

        <div className={s.foot}>
          <span className={s.footLeft}>
            {showComplete &&
              (running ? (
                <TaskProgress
                  compact
                  phases={PHASES.assetPrompt}
                  durationMs={taskDuration(costAssetPrompt())}
                  onDone={() => {
                    onComplete?.()
                    setRunning(false)
                  }}
                />
              ) : (
                <button className={s.completeBtn} onClick={() => setRunning(true)}>
                  ✦ AI 结合剧本补全 · {fmtCost(costAssetPrompt())}
                </button>
              ))}
          </span>
          <span className={s.footRight}>
            <button className={ui.btn} onClick={onClose}>取消</button>
            {editable && (
              <button
                className={[ui.btn, ui.btnPrimary].join(' ')}
                disabled={!dirty}
                onClick={save}
              >
                保存
              </button>
            )}
          </span>
        </div>
      </div>
    </div>
  )
}
