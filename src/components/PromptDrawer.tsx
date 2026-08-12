import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
import type { Asset } from '../data/types'
import { can } from '../services/capability'
import { syncState } from '../services/staleness'
import { lookName } from '../services/looks'
import { chipClass, KIND_LABEL } from './entity'
import { PromptSections } from './PromptSections'
import { SyncBadge } from './SyncBadge'
import ui from '../styles/ui.module.css'
import s from './PromptDrawer.module.css'

// 右侧提示词抽屉（宽 480px）。完整版提示词一条 8 段几千字，塞进条目内展开会撑爆列表，
// 所以全文进抽屉：只读分段展示 + 一个「编辑」切到 textarea，保存走 updateAssetPrompt（promptRevision + 1）。
export function PromptDrawer({ assetId, onClose }: { assetId: string; onClose: () => void }) {
  const asset = useStore((st) => st.project.assets[assetId]) as Asset | undefined
  const assets = useStore((st) => st.project.assets)
  const canEdit = useStore((st) => can(st.project, 'editPrompt'))
  const updatePrompt = useStore((st) => st.updateAssetPrompt)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // 切换资产时退出编辑态。
  useEffect(() => {
    setEditing(false)
  }, [assetId])

  if (!asset) return null
  const title = asset.kind === 'look' ? lookName(asset, assets) : asset.name

  const startEdit = () => {
    setDraft(asset.imagePrompt)
    setEditing(true)
  }
  const save = () => {
    updatePrompt(assetId, draft)
    setEditing(false)
  }
  const copy = () => {
    void navigator.clipboard?.writeText(asset.imagePrompt)
  }

  return (
    <div className={s.mask} onClick={onClose}>
      <aside className={s.drawer} onClick={(e) => e.stopPropagation()}>
        <div className={s.head}>
          <span className={s.title}>{title}</span>
          <span className={[ui.chip, chipClass(asset.kind)].join(' ')}>
            <span className={ui.odot} />
            {KIND_LABEL[asset.kind]}
          </span>
          <SyncBadge state={syncState(asset)} />
          <button className={s.close} onClick={onClose} title="关闭（Esc）">
            ✕
          </button>
        </div>

        <div className={s.body}>
          {editing ? (
            <textarea
              className={s.textarea}
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
            />
          ) : (
            <PromptSections text={asset.imagePrompt} />
          )}
        </div>

        <div className={s.foot}>
          <button className={ui.btn} onClick={copy}>复制</button>
          <span className={s.spacer} />
          {editing ? (
            <>
              <button className={ui.btn} onClick={() => setEditing(false)}>取消</button>
              <button className={[ui.btn, ui.btnPrimary].join(' ')} onClick={save}>保存</button>
            </>
          ) : (
            canEdit && <button className={[ui.btn, ui.btnPrimary].join(' ')} onClick={startEdit}>编辑</button>
          )}
        </div>
      </aside>
    </div>
  )
}
