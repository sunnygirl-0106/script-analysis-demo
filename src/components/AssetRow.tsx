import { useState, type MouseEvent as ReactMouseEvent } from 'react'
import { useStore } from '../store/useStore'
import type { Asset } from '../data/types'
import { can } from '../services/capability'
import { syncState } from '../services/staleness'
import { lookName, looksUsingCostume } from '../services/looks'
import { parsePromptSections } from '../services/promptFormat'
import { KIND_DOT, KIND_LABEL } from './entity'
import { SyncBadge } from './SyncBadge'
import { AppearanceSummary } from './AppearanceSummary'
import s from './AssetList.module.css'

// 提示词正文：去掉【生成规格】技术段（分辨率/画幅/机位等，不进展示），其余段落正文连读。
// CSS 再做两行截断。
function cardBody(text: string): string {
  return parsePromptSections(text)
    .filter((sec) => sec.tag !== '生成规格')
    .map((sec) => sec.body)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function firstShort(fa: { episodeNo: number; sceneNo: number } | undefined): string {
  return fa ? `首现 ${fa.episodeNo}集${fa.sceneNo}场` : '未出场'
}

// 内联改名：点名字进编辑态，回车 / 失焦保存。仅 analysis 阶段可用（editAssetName）。
function EditableName({ id, name, className }: { id: string; name: string; className: string }) {
  const canRename = useStore((st) => can(st.project, 'editAssetName'))
  const rename = useStore((st) => st.renameAsset)
  const [editing, setEditing] = useState(false)
  const [v, setV] = useState(name)
  if (!canRename) return <span className={className}>{name}</span>
  if (editing) {
    return (
      <input
        className={s.nmInput}
        value={v}
        autoFocus
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => { rename(id, v); setEditing(false) }}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      />
    )
  }
  return (
    <span
      className={className}
      title="点击改名"
      onClick={(e) => { e.stopPropagation(); setV(name); setEditing(true) }}
    >
      {name}
    </span>
  )
}

interface Props {
  asset: Asset
  /** 角色造型(look) 子行：缩进、圆点透明+描边、名称略小。 */
  sub?: boolean
  onOpenPrompt: (assetId: string, rowEl: HTMLElement) => void
}

// 「安静版」表格行：圆点 / 名称 / 提示词 / 出场 四列共用一套渲染，按 kind 分支补充右列状态。
export function AssetRow({ asset, sub, onOpenPrompt }: Props) {
  const assets = useStore((st) => st.project.assets)
  const usageIndex = useStore((st) => st.usageIndex())
  const canExclude = useStore((st) => can(st.project, 'toggleExcluded'))
  const toggleExcluded = useStore((st) => st.toggleAssetExcluded)

  const usage = usageIndex[asset.id] ?? { appearances: [], shotCount: 0 }
  const dot = KIND_DOT[asset.kind]
  const name = asset.kind === 'look' ? lookName(asset, assets) : asset.name

  // 名称下方 meta 行：服装显示「用于 X 造型」，其余显示首现。
  const usedBy = asset.kind === 'costume' ? looksUsingCostume(asset.id, assets) : []
  const meta =
    asset.kind === 'costume'
      ? null // usedBy 单独渲染 chips
      : sub
        ? '' // 造型子行不再重复首现（并入角色）
        : firstShort(usage.firstAppearance)

  const open = (e: ReactMouseEvent<HTMLDivElement>) =>
    onOpenPrompt(asset.id, e.currentTarget)

  return (
    <div
      className={[s.row, sub ? s.rowSub : '', asset.excluded ? s.rowExcluded : ''].join(' ')}
      onClick={open}
      title="点击编辑提示词"
    >
      {/* 类目色圆点（唯一着色处） */}
      <div className={s.dotCell}>
        <i
          className={[s.dot, sub ? s.dotSub : ''].join(' ')}
          style={sub ? { borderColor: dot } : { background: dot, borderColor: dot }}
        />
      </div>

      {/* 名称 + 类目标签 + meta */}
      <div className={s.nameCell}>
        <span className={s.nameLine}>
          <EditableName id={asset.id} name={name} className={sub ? s.nameSub : s.name} />
          <span className={s.kindTag}>{KIND_LABEL[asset.kind]}</span>
        </span>
        {usedBy.length > 0 ? (
          <span className={s.metaLine}>
            <span className={s.usedLabel}>用于</span>
            {usedBy.map((lk) => (
              <span key={lk.id} className={s.miniChip}>{lookName(lk, assets)}</span>
            ))}
          </span>
        ) : (
          meta && <span className={s.metaLine}>{meta}</span>
        )}
      </div>

      {/* 提示词正文（两行截断） */}
      <div className={s.promptCell}>
        <span className={s.promptText}>{cardBody(asset.imagePrompt)}</span>
      </div>

      {/* 出场（只管戏份统计） */}
      <div className={s.apprCell}>
        <AppearanceSummary appearances={usage.appearances} shotCount={usage.shotCount} column />
      </div>

      {/* 状态（生成进度 / 道具排除，独立一列，整列对齐易扫） */}
      <div className={s.statusCell}>
        {asset.kind === 'prop' ? (
          <button
            className={s.exclBtn}
            disabled={!canExclude}
            onClick={(e) => { e.stopPropagation(); toggleExcluded(asset.id) }}
            title={asset.excluded ? '加入生成' : '暂不生成此素材'}
          >
            {asset.excluded ? '○ 暂不生成' : '● 待生成'}
          </button>
        ) : (
          <SyncBadge state={syncState(asset)} compact />
        )}
      </div>
    </div>
  )
}
