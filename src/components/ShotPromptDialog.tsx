import { useEffect, useRef, useState } from 'react'
import { Dialog } from './Dialog'
import { useStore } from '../store/useStore'
import type { Shot } from '../data/types'
import { EntityText } from './EntityText'
import { AtMentionPicker } from './AtMentionPicker'
import { costShotPrompts, fmtCost } from '../services/cost'
import { PHASES, taskDuration } from '../services/taskRun'
import { TaskProgress } from './TaskProgress'
import ui from '../styles/ui.module.css'
import s from './ShotPromptDialog.module.css'

// 镜头提示词弹窗：画面 / 视频两段提示词的唯一出入口。
// 待生成态：两个框留空、只给小灰字引导，右下「立即生成提示词」一键生成；
// 已生成态：同一套框里显示生成结果，右下变「重新生成提示词」。两态版式完全一致。
// 用户手动改写并保存任一段 → markPromptEdited，落一个 ✎ 标记（重新生成会覆盖）。
const MODELS = ['豆包 4.5', '即梦 3.0', '可灵 2.1', 'Seedance 1.0', 'Vidu 2.0']
// 一镜生成画面 + 视频两段提示词的预估星钻（每镜 ✦6，口径与批量弹窗一致）。
const GEN_COST = costShotPrompts(['_one'])

export function ShotPromptDialog({
  shot,
  focus,
  readOnly,
  onClose,
}: {
  shot: Shot
  focus: 'image' | 'video'
  readOnly: boolean
  onClose: () => void
}) {
  const updateShotField = useStore((st) => st.updateShotField)
  const generatePrompts = useStore((st) => st.generatePrompts)
  const setPromptState = useStore((st) => st.setPromptState)
  const markPromptEdited = useStore((st) => st.markPromptEdited)
  const showToast = useStore((st) => st.showToast)
  // 缺键即 pending —— 状态表是惰性的，只记录「不是 pending」的镜头。
  const promptState = useStore((st) => st.promptStates[shot.id] ?? 'pending')

  const revealed = promptState === 'ready' || promptState === 'stale'
  const [img, setImg] = useState(revealed ? shot.imagePrompt : '')
  const [vid, setVid] = useState(revealed ? shot.videoPrompt : '')
  const [imgDirty, setImgDirty] = useState(false)
  const [vidDirty, setVidDirty] = useState(false)
  const [model, setModel] = useState(MODELS[0])
  const [running, setRunning] = useState(false)
  const imgRef = useRef<HTMLTextAreaElement>(null)
  const vidRef = useRef<HTMLTextAreaElement>(null)

  // 生成完成（generating → ready）→ 把结果揭示进两个框。
  const prev = useRef(promptState)
  useEffect(() => {
    if (prev.current === 'generating' && promptState === 'ready') {
      setImg(shot.imagePrompt)
      setVid(shot.videoPrompt)
      setImgDirty(false)
      setVidDirty(false)
    }
    prev.current = promptState
  }, [promptState, shot.imagePrompt, shot.videoPrompt])

  const close = () => {
    if (!readOnly) {
      let touched = false
      if (imgDirty && img !== shot.imagePrompt) {
        updateShotField(shot.id, 'imagePrompt', img)
        touched = true
      }
      if (vidDirty && vid !== shot.videoPrompt) {
        updateShotField(shot.id, 'videoPrompt', vid)
        touched = true
      }
      // 待生成态下手动写了提示词 → 提为已生成。
      if (promptState === 'pending' && (img.trim() || vid.trim())) setPromptState(shot.id, 'ready')
      // 手动改写了任一段提示词 → 落 ✎ 手动标记。
      if (touched) markPromptEdited(shot.id)
    }
    onClose()
  }


  const copy = (label: string, text: string) => async () => {
    if (!text.trim()) {
      showToast('这一段还没有内容可复制。')
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      showToast(`已复制${label}（${text.length} 字）`)
    } catch {
      showToast('复制失败，请选中文本后手动复制。')
    }
  }

  const generating = promptState === 'generating'

  const fields = [
    {
      key: 'image' as const,
      label: '画面提示词',
      value: img,
      ref: imgRef,
      set: (v: string) => {
        setImg(v)
        setImgDirty(true)
      },
      placeholder: '点击输入画面提示词，或点右下角「立即生成提示词」自动生成',
    },
    {
      key: 'video' as const,
      label: '视频提示词',
      value: vid,
      ref: vidRef,
      set: (v: string) => {
        setVid(v)
        setVidDirty(true)
      },
      placeholder: '点击输入视频提示词，或点右下角「立即生成提示词」自动生成',
    },
  ]

  return (
    <Dialog
      onClose={close}
      className={s.dialog}
    >
      <div className={s.titleRow}>
        <div className={s.title}>
          第 {shot.no} 镜 · {shot.title}
        </div>
        <button className={s.close} onClick={close} title="关闭">
          ✕
        </button>
      </div>

      <div className={s.cols}>
        {fields.map((f) => (
          <section className={s.box} key={f.key}>
            <header className={s.h}>
              <b>{f.label}</b>
              <em>{f.value.length} 字</em>
              <button className={s.copy} onClick={copy(f.label, f.value)} title="复制整段">
                复制
              </button>
            </header>
            {/* 彩色背板（按类目上色）+ 透明文字 textarea 叠在一起：查看与编辑都保持颜色。 */}
            <div className={s.editWrap}>
              <div className={s.backdrop} aria-hidden>
                {f.value ? (
                  <EntityText text={f.value} variant="mark" />
                ) : (
                  <span className={s.ph}>{f.placeholder}</span>
                )}
                {/* 末尾换行时补一个占位，保证背板与 textarea 行高一致 */}
                {f.value.endsWith('\n') && '​'}
              </div>
              <textarea
                ref={f.ref}
                className={s.textarea}
                value={f.value}
                readOnly={readOnly}
                autoFocus={f.key === focus}
                spellCheck={false}
                onChange={(e) => f.set(e.target.value)}
                onScroll={(e) => {
                  const b = (e.currentTarget.previousElementSibling as HTMLElement) ?? null
                  if (b) {
                    b.scrollTop = e.currentTarget.scrollTop
                    b.scrollLeft = e.currentTarget.scrollLeft
                  }
                }}
              />
              {!readOnly && (
                <AtMentionPicker textareaRef={f.ref} value={f.value} onChange={f.set} shotId={shot.id} />
              )}
            </div>
          </section>
        ))}
      </div>

      {!readOnly && <div className={s.foot}>输入 @ 选择资产 · 自动保存</div>}

      <div className={s.actions}>
        <label className={s.modelPick}>
          生成模型
          <select
            className={s.modelSelect}
            value={model}
            disabled={readOnly}
            onChange={(e) => setModel(e.target.value)}
          >
            {MODELS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <span className={s.spacer} />
        {readOnly ? (
          <button className={[ui.btn, ui.btnPrimary].join(' ')} onClick={close}>
            关闭
          </button>
        ) : running ? (
          <span style={{ flex: 1, minWidth: 0 }}>
            <TaskProgress
              compact
              phases={PHASES.shotPrompt}
              durationMs={taskDuration(GEN_COST)}
              onDone={() => { generatePrompts([shot.id]); setRunning(false) }}
            />
          </span>
        ) : (
          <button
            className={[ui.btn, ui.btnPrimary].join(' ')}
            disabled={generating}
            onClick={() => setRunning(true)}
          >
            {generating && <span className={s.spin} />}
            {revealed ? `确认并重新生成 · ${fmtCost(GEN_COST)}` : `生成 · ${fmtCost(GEN_COST)}`}
          </button>
        )}
      </div>
    </Dialog>
  )
}
