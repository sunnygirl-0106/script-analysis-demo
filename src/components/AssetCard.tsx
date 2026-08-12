import { useState } from 'react'
import { useStore } from '../store/useStore'
import type { Asset, Character, Look } from '../data/types'
import { chipClass } from './entity'
import { AppearanceSummary } from './AppearanceSummary'
import { PromptSections } from './PromptSections'
import { looksOfCharacter, looksUsingCostume } from '../services/looks'
import { isProductionStale } from '../services/production'
import ui from '../styles/ui.module.css'
import s from './AssetGrid.module.css'

function roleLabel(role: Character['role']) {
  return role === 'lead' ? '主角' : role === 'support' ? '配角' : '龙套'
}

// 同步状态：只有下发过生产（productionRevision 有值）才显示。改了提示词就「待重新生成」。
function StatusBadge({ asset }: { asset: Asset }) {
  if (asset.productionRevision == null) return null
  return isProductionStale(asset) ? (
    <span className={s.badgeStale}>修改后待重新生成</span>
  ) : (
    <span className={s.badgeSynced}>已同步</span>
  )
}

// 提示词：默认 3 行摘要，可展开全文，可编辑（保存统一走 updateAssetPrompt）。
function PromptEditor({ asset, label }: { asset: Asset; label: string }) {
  const update = useStore((st) => st.updateAssetPrompt)
  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState(asset.imagePrompt)

  const beginEdit = () => {
    setDraft(asset.imagePrompt)
    setEditing(true)
    setExpanded(true)
  }
  const save = () => {
    update(asset.id, draft)
    setEditing(false)
  }
  const cancel = () => {
    setDraft(asset.imagePrompt)
    setEditing(false)
  }

  return (
    <div className={s.prompt}>
      <div className={s.promptHead}>
        <span className={s.promptLabel}>{label}</span>
        {!editing && (
          <>
            <button className={s.linkBtn} onClick={() => setExpanded((v) => !v)}>
              {expanded ? '收起' : '展开全文'}
            </button>
            <button className={s.linkBtn} onClick={beginEdit}>
              ✎ 编辑
            </button>
          </>
        )}
      </div>
      {editing ? (
        <div className={s.editWrap}>
          <textarea className={s.textarea} value={draft} onChange={(e) => setDraft(e.target.value)} rows={10} />
          <div className={s.editActions}>
            <button className={ui.btn} onClick={cancel}>
              取消
            </button>
            <button className={[ui.btn, ui.btnPrimary].join(' ')} onClick={save}>
              保存
            </button>
          </div>
        </div>
      ) : (
        <div className={expanded ? s.promptFull : s.promptPreview}>
          <PromptSections text={asset.imagePrompt} />
        </div>
      )}
    </div>
  )
}

// 着装角色的两个只读关系 chip（角色 🔒 + 服装 🔒），永远不提供删除 / 替换。
function LookRelation({ look }: { look: Look }) {
  const assets = useStore((st) => st.project.assets)
  const character = assets[look.characterId]
  const costume = assets[look.costumeId]
  return (
    <div className={s.lockRow}>
      <span className={[ui.chip, chipClass('character'), ui.chipLock].join(' ')}>
        <span className={ui.odot} />
        角色：{character?.name ?? '（缺失）'}
        <span className={ui.lock}>🔒</span>
      </span>
      <span className={s.plus}>+</span>
      <span className={[ui.chip, chipClass('costume'), ui.chipLock].join(' ')}>
        <span className={ui.odot} />
        服装：{costume?.name ?? '（缺失）'}
        <span className={ui.lock}>🔒</span>
      </span>
    </div>
  )
}

export function AssetCard({ asset }: { asset: Asset }) {
  const assets = useStore((st) => st.project.assets)
  const countShotsOf = useStore((st) => st.countShotsOf)
  const [showUses, setShowUses] = useState(false)

  const looks = asset.kind === 'character' ? looksOfCharacter(asset.id, assets) : []
  const usedByLooks = asset.kind === 'costume' ? looksUsingCostume(asset.id, assets) : []

  const promptLabel =
    asset.kind === 'character'
      ? '角色提示词'
      : asset.kind === 'costume'
        ? '服装提示词'
        : asset.kind === 'location'
          ? '场景提示词'
          : '道具提示词'

  return (
    <div className={s.card}>
      <div className={s.h}>
        <span className={s.nm}>{asset.name}</span>
        {asset.kind === 'character' && <span className={s.tg}>{roleLabel(asset.role)}</span>}
        {asset.kind === 'costume' && <span className={s.tg}>用于 {usedByLooks.length} 个着装角色</span>}
        {asset.kind === 'location' && <span className={s.tg}>{asset.timeOfDay}</span>}
        <StatusBadge asset={asset} />
        <AppearanceSummary appearances={asset.appearances} shotCount={countShotsOf(asset.id)} />
      </div>

      <div className={s.bio}>{asset.description}</div>

      {/* 角色：着装角色子列表（角色 × 服装的只读关系 + 各自可编辑的提示词） */}
      {asset.kind === 'character' && looks.length > 0 && (
        <>
          <div className={s.hr} />
          <div className={s.subTitle}>着装角色 · {looks.length}</div>
          {looks.map((lk) => (
            <div className={s.lookItem} key={lk.id}>
              <div className={s.lookHead}>
                <span className={s.lookName}>{lk.name}</span>
                <StatusBadge asset={lk} />
                <AppearanceSummary appearances={lk.appearances} shotCount={countShotsOf(lk.id)} compact />
              </div>
              <LookRelation look={lk} />
              <PromptEditor asset={lk} label="着装角色提示词" />
            </div>
          ))}
        </>
      )}

      {/* 服装：被哪些着装角色引用（不显示「属于某角色」，同一服装可被 0 / 1 / 多个引用） */}
      {asset.kind === 'costume' && (
        <>
          <div className={s.hr} />
          {usedByLooks.length === 0 ? (
            <div className={s.subTitle}>暂未被任何着装角色引用</div>
          ) : (
            <>
              <div className={s.foldLine} onClick={() => setShowUses((v) => !v)}>
                {showUses ? '▾' : '▸'} 用于 {usedByLooks.length} 个着装角色
              </div>
              {showUses && (
                <div className={s.useList}>
                  {usedByLooks.map((lk) => (
                    <div className={s.useItem} key={lk.id}>
                      <span className={[ui.chip, chipClass('look')].join(' ')}>
                        <span className={ui.odot} />
                        {lk.name}
                      </span>
                      <span className={s.useChar}>角色：{assets[lk.characterId]?.name ?? '（缺失）'}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* 自身提示词（五类统一可编辑） */}
      <div className={s.hr} />
      <PromptEditor asset={asset} label={promptLabel} />
    </div>
  )
}
