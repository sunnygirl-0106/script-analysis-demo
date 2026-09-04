import { useEffect, useRef, useState } from 'react'
import { Dialog } from './Dialog'
import { TaskProgress } from './TaskProgress'
import { PHASES, taskDuration } from '../services/taskRun'
import { costAssetPrompt, fmtCost } from '../services/cost'
import ui from '../styles/ui.module.css'
import d from '../styles/dialog.module.css'
import s from './CandidatePromptDialog.module.css'
import { ic } from './icons'

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


  const dirty = draft !== text
  const save = () => {
    onSave(draft)
    onClose()
  }
  const showComplete = editable && !!onComplete && !draft.trim()

  return (
    <Dialog
      onClose={onClose}
      className={s.pop}
    >
      <div className={s.head}>
        <span className={s.headLeft}>
          <span className={[d.title, s.headName].join(' ')}>{title} · 生成提示词</span>
          {!editable && <span className={s.roTag}>已入库 · 只读</span>}
        </span>
        <span className={s.headSlot}>
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
              <button
                className={[ui.btn, ui.btnSm, s.completeBtn].join(' ')}
                onClick={() => setRunning(true)}
              >
                {ic.spark} AI 补全 · {fmtCost(costAssetPrompt())}
              </button>
            ))}
          <button className={d.close} onClick={onClose} title="关闭">
            {ic.close}
          </button>
        </span>
      </div>
      {/* 可编辑时不写说明：标题已经说了这是什么，脚栏已经说了会自动保存，
          中间再插一句「改完记得保存」是在说一件界面本身已经做到的事。
          只读态才需要一句——「为什么不能改」和「那要改怎么办」不写出来没人猜得到。 */}
      {!editable && (
        <div className={d.desc}>资产已入库，提示词不再可改。需要调整请新增造型。</div>
      )}

      <textarea
        className={s.textarea}
        value={draft}
        autoFocus
        readOnly={!editable}
        spellCheck={false}
        placeholder={editable ? '在此填入详细提示词' : ''}
        onChange={(e) => setDraft(e.target.value)}
      />

      <div className={s.foot}>
        {editable && <span className={d.footNote}>自动保存为最新版本</span>}
        <span className={d.footBtns}>
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
    </Dialog>
  )
}
