import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
import type { Asset } from '../data/types'
import { lookName } from '../services/looks'
import { summarizeAppearances } from '../services/appearance'
import { KIND_DOT, KIND_LABEL } from './entity'
import s from './PromptDialog.module.css'

const POP_W = 620
const POP_H = 470

// 贴着被点行弹出的提示词浮层：点提示词直接进入可编辑大文本框，取消 / 保存即走。
// 保存走 updateAssetPrompt：内容有变才 promptRevision + 1（编辑内核不变，只换定位与外观）。
export function PromptDialog({
  assetId,
  anchor,
  onClose,
}: {
  assetId: string
  anchor: DOMRect
  onClose: () => void
}) {
  const asset = useStore((st) => st.project.assets[assetId]) as Asset | undefined
  const assets = useStore((st) => st.project.assets)
  const usage = useStore((st) => st.usageIndex()[assetId])
  const updatePrompt = useStore((st) => st.updateAssetPrompt)
  const [draft, setDraft] = useState(asset?.imagePrompt ?? '')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!asset) return null
  const title = asset.kind === 'look' ? lookName(asset, assets) : asset.name
  const dirty = draft !== asset.imagePrompt

  // 定位：贴被点行、落在提示词列上方；上下夹到视口内。
  const vw = window.innerWidth
  const vh = window.innerHeight
  const left = Math.min(Math.max(anchor.left + 190, 12), Math.max(12, vw - POP_W - 12))
  const top = Math.min(Math.max(anchor.top - 8, 12), Math.max(12, vh - POP_H - 12))

  const apprShort = (() => {
    if (!usage || usage.appearances.length === 0) return '未出场'
    const sum = summarizeAppearances(usage.appearances)
    return sum.episodeCount === 1
      ? `${sum.sceneCount} 场 · ${usage.shotCount} 镜`
      : `${sum.episodeCount} 集 · ${sum.sceneCount} 场 · ${usage.shotCount} 镜`
  })()

  const save = () => {
    updatePrompt(assetId, draft)
    onClose()
  }

  return (
    <div className={s.overlay} onClick={onClose}>
      <div
        className={s.pop}
        style={{ left, top, width: POP_W }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={s.head}>
          <i className={s.headDot} style={{ background: KIND_DOT[asset.kind] }} />
          <span className={s.headKind}>{KIND_LABEL[asset.kind]}</span>
          <span className={s.headName}>{title}</span>
          <span className={s.headAppr}>{apprShort}</span>
          <button className={s.close} onClick={onClose} title="关闭">✕</button>
        </div>

        <div className={s.body}>
          <div className={s.bodyLabel}>
            <span className={s.bodyLabelText}>生图提示词</span>
            <span className={s.bodyLabelRule} />
            <span className={s.count}>{draft.length} 字</span>
          </div>
          <textarea
            className={s.textarea}
            value={draft}
            autoFocus
            spellCheck={false}
            onChange={(e) => setDraft(e.target.value)}
          />
        </div>

        <div className={s.foot}>
          <span className={s.footNote}>改动保存会直接更新至下一步出图提示词</span>
          {dirty && <span className={s.dirty}>已修改</span>}
          <span className={s.footRight}>
            <button className={s.btnGhost} onClick={onClose}>取消</button>
            <button
              className={[s.btnSave, dirty ? s.btnSaveOn : ''].join(' ')}
              onClick={save}
            >
              保存
            </button>
          </span>
        </div>
      </div>
    </div>
  )
}
