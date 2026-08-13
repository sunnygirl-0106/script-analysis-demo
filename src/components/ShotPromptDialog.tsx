import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
import type { Shot } from '../data/types'
import ui from '../styles/ui.module.css'
import s from './ShotPromptDialog.module.css'

// 镜头提示词编辑弹窗：点分镜表里的「画面 / 视频提示词」格子直接打开，两段都可编辑。
// 取代原来从底部展开的 ShotDetail 抽屉 —— 参数（景别/焦段/…）也搬进来，作为这些字段的出口。
// 保存走 updateShotField，只写有变化的那一段。
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
  const showToast = useStore((st) => st.showToast)
  const [img, setImg] = useState(shot.imagePrompt)
  const [vid, setVid] = useState(shot.videoPrompt)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const params: [string, string][] = [
    ['景别', shot.shotSize],
    ['焦段', shot.lens],
    ['光影', shot.lighting],
    ['运镜', shot.cameraMove],
    ['对白', shot.dialogue],
    ['音效', shot.sfx],
  ]

  const copy = (label: string, text: string) => async () => {
    try {
      await navigator.clipboard.writeText(text)
      showToast(`已复制${label}（${text.length} 字）`)
    } catch {
      showToast('复制失败，请选中文本后手动复制。')
    }
  }

  const save = () => {
    if (img !== shot.imagePrompt) updateShotField(shot.id, 'imagePrompt', img)
    if (vid !== shot.videoPrompt) updateShotField(shot.id, 'videoPrompt', vid)
    onClose()
  }

  const fields: {
    key: 'image' | 'video'
    label: string
    value: string
    set: (v: string) => void
    raw: string
  }[] = [
    { key: 'image', label: '画面提示词', value: img, set: setImg, raw: shot.imagePrompt },
    { key: 'video', label: '视频提示词', value: vid, set: setVid, raw: shot.videoPrompt },
  ]

  return (
    <div className={s.overlay} onClick={onClose}>
      <div className={s.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={s.title}>
          第 {shot.no} 镜 · {shot.title}
        </div>

        <div className={s.params}>
          {params.map(([k, v]) => (
            <span className={s.param} key={k}>
              <i>{k}</i>
              {v || '—'}
            </span>
          ))}
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
              <textarea
                className={s.textarea}
                value={f.value}
                readOnly={readOnly}
                autoFocus={f.key === focus}
                spellCheck={false}
                onChange={(e) => f.set(e.target.value)}
              />
            </section>
          ))}
        </div>

        <div className={s.actions}>
          <button className={ui.btn} onClick={onClose}>
            {readOnly ? '关闭' : '取消'}
          </button>
          {!readOnly && (
            <button className={[ui.btn, ui.btnPrimary].join(' ')} onClick={save}>
              保存
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
