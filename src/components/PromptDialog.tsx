import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
import type { Asset } from '../data/types'
import { lookName } from '../services/looks'
import ui from '../styles/ui.module.css'
import s from './PromptDialog.module.css'

// 提示词编辑弹窗：点「提示词」直接进入可编辑的大文本框，取消 / 保存即走。
// 不做「只读 → 再点编辑」两段式，也不做侧栏 —— 用户要改提示词就让他立刻改到（用户反馈）。
// 保存走 updateAssetPrompt：内容有变才 promptRevision + 1。
export function PromptDialog({ assetId, onClose }: { assetId: string; onClose: () => void }) {
  const asset = useStore((st) => st.project.assets[assetId]) as Asset | undefined
  const assets = useStore((st) => st.project.assets)
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

  const save = () => {
    updatePrompt(assetId, draft)
    onClose()
  }

  return (
    <div className={s.overlay} onClick={onClose}>
      <div className={s.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={s.title}>{title} · 提示词</div>
        <textarea
          className={s.textarea}
          value={draft}
          autoFocus
          spellCheck={false}
          onChange={(e) => setDraft(e.target.value)}
        />
        <div className={s.actions}>
          <button className={ui.btn} onClick={onClose}>取消</button>
          <button className={[ui.btn, ui.btnPrimary].join(' ')} onClick={save}>保存</button>
        </div>
      </div>
    </div>
  )
}
