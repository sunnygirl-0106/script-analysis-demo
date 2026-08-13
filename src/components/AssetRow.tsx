import { useState } from 'react'
import { useStore } from '../store/useStore'
import type { Asset, Character } from '../data/types'
import { can } from '../services/capability'
import { syncState } from '../services/staleness'
import { lookName, looksOfCharacter, looksUsingCostume } from '../services/looks'
import { parsePromptSections } from '../services/promptFormat'
import { EpisodeStrip } from './EpisodeStrip'
import { SyncBadge } from './SyncBadge'
import { AppearanceSummary } from './AppearanceSummary'
import s from './AssetList.module.css'

// 卡片正文：去掉【生成规格】技术段（分辨率/画幅/机位等，不进展示），其余段落正文连读。
// 角色素模 → 体型/面部/发型…；着装 → 着装融合说明。CSS 再做多行截断。
function cardBody(text: string): string {
  return parsePromptSections(text)
    .filter((sec) => sec.tag !== '生成规格')
    .map((sec) => sec.body)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function firstText(fa: { episodeNo: number; sceneNo: number } | undefined): string {
  return fa ? `首次出现在第 ${fa.episodeNo} 集 · 第 ${fa.sceneNo} 场` : '未出场'
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
        onChange={(e) => setV(e.target.value)}
        onBlur={() => { rename(id, v); setEditing(false) }}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      />
    )
  }
  return (
    <span className={className} title="点击改名" onClick={() => { setV(name); setEditing(true) }}>{name}</span>
  )
}

interface Props {
  asset: Asset
  onOpenPrompt: (assetId: string) => void
}

export function AssetRow({ asset, onOpenPrompt }: Props) {
  const assets = useStore((st) => st.project.assets)
  const usageIndex = useStore((st) => st.usageIndex())
  const totalEpisodes = useStore((st) => st.project.episodes.length)
  const canExclude = useStore((st) => can(st.project, 'toggleExcluded'))
  const toggleExcluded = useStore((st) => st.toggleAssetExcluded)

  const usage = usageIndex[asset.id] ?? { appearances: [], shotCount: 0 }
  // 提示词正文：点一下即打开编辑（无独立「展开编辑」入口）。
  const promptText = (id: string, text: string, short?: boolean) => (
    <div
      className={[s.cellBody, short ? s.cellBodyShort : ''].join(' ')}
      onClick={() => onOpenPrompt(id)}
      title="点击编辑提示词"
    >
      {cardBody(text)}
    </div>
  )

  // ── 道具：紧凑卡 ──
  if (asset.kind === 'prop') {
    return (
      <div className={[s.card, asset.excluded ? s.cardExcluded : ''].join(' ')}>
        <div className={s.cHead}>
          <span className={[s.cellDot, s.dotBase].join(' ')} />
          <span className={s.cellKind}>道具</span>
          <EditableName id={asset.id} name={asset.name} className={s.cNameSm} />
          <span className={s.cHeadRight}>
            <button
              className={s.exclBtn}
              disabled={!canExclude}
              onClick={() => toggleExcluded(asset.id)}
              title={asset.excluded ? '加入生成' : '暂不生成此素材'}
            >
              {asset.excluded ? '○ 暂不生成' : '● 待生成'}
            </button>
          </span>
        </div>
        {promptText(asset.id, asset.imagePrompt, true)}
        <div className={s.cellFoot}>
          <span className={s.footNote}>
            <AppearanceSummary appearances={usage.appearances} shotCount={usage.shotCount} compact />
          </span>        </div>
      </div>
    )
  }

  // ── 场景 ──
  if (asset.kind === 'location') {
    return (
      <div className={s.card}>
        <div className={s.cHead}>
          <span className={[s.cellDot, s.dotBase].join(' ')} />
          <span className={s.cellKind}>场景</span>
          <EditableName id={asset.id} name={asset.name} className={s.cNameSm} />
          <span className={s.cHeadRight}><SyncBadge state={syncState(asset)} /></span>
        </div>
        {promptText(asset.id, asset.imagePrompt)}
        <div className={s.cellFoot}>
          <EpisodeStrip totalEpisodes={totalEpisodes} appearances={usage.appearances} />
          <span className={s.footNote}>
            <AppearanceSummary appearances={usage.appearances} shotCount={usage.shotCount} />
          </span>        </div>
      </div>
    )
  }

  // ── 服装：不显示归属，改为显示被哪些角色造型使用 ──
  if (asset.kind === 'costume') {
    const usedBy = looksUsingCostume(asset.id, assets)
    return (
      <div className={s.card}>
        <div className={s.cHead}>
          <span className={[s.cellDot, s.dotDress].join(' ')} />
          <span className={s.cellKind}>服装</span>
          <EditableName id={asset.id} name={asset.name} className={s.cNameSm} />
          <span className={s.cHeadRight}><SyncBadge state={syncState(asset)} /></span>
        </div>
        {promptText(asset.id, asset.imagePrompt)}
        {usedBy.length > 0 && (
          <div className={s.usedBy}>
            <span className={s.usedLabel}>用于</span>
            {usedBy.map((lk) => (
              <span key={lk.id} className={s.miniChip}>{lookName(lk, assets)}</span>
            ))}
          </div>
        )}
        <div className={s.cellFoot}>
          <EpisodeStrip totalEpisodes={totalEpisodes} appearances={usage.appearances} />
          <span className={s.footNote}>
            <AppearanceSummary appearances={usage.appearances} shotCount={usage.shotCount} />
          </span>        </div>
      </div>
    )
  }

  // ── 角色：大卡，卡体合并「角色素模 + 着装（造型）」双列 ──
  const character = asset as Character
  const looks = looksOfCharacter(character.id, assets)
  return (
    <div className={s.card}>
      <div className={s.cHead}>
        <EditableName id={character.id} name={character.name} className={s.cName} />
        <span className={s.cMeta}>{firstText(usage.firstAppearance)}</span>
        <span className={s.cMeta}>·</span>
        <span className={s.cMeta}>
          <AppearanceSummary appearances={usage.appearances} shotCount={usage.shotCount} />
        </span>
        <span className={s.cHeadRight}><SyncBadge state={syncState(asset)} /></span>
      </div>

      <div className={s.assetGrid}>
        {/* 角色（基础形象） */}
        <div className={s.cell2}>
          <div className={s.cellHead}>
            <span className={[s.cellDot, s.dotBase].join(' ')} />
            <span className={s.cellKind}>角色</span>
            <span className={s.cellName}>{character.name}</span>
            <span className={s.cellTagR}>基础形象</span>
          </div>
          {promptText(character.id, character.imagePrompt)}
        </div>

        {/* 着装（角色造型 look，每套一格） */}
        {looks.map((lk) => {
          const lu = usageIndex[lk.id] ?? { appearances: [], shotCount: 0 }
          return (
            <div className={s.cell2} key={lk.id}>
              <div className={s.cellHead}>
                <span className={[s.cellDot, s.dotDress].join(' ')} />
                <span className={s.cellKind}>着装</span>
                <span className={s.cellName}>{lookName(lk, assets)}</span>
                <span className={s.cellTagR}>{lu.appearances.length ? `${new Set(lu.appearances.map((a) => `${a.episodeNo}-${a.sceneNo}`)).size} 场` : '未出场'}</span>
              </div>
              {promptText(lk.id, lk.imagePrompt)}
              <div className={s.cellFoot}>
                <SyncBadge state={syncState(lk)} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
