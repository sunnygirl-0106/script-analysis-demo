import { useState } from 'react'
import { useStore } from '../store/useStore'
import type { Asset, Character } from '../data/types'
import { can } from '../services/capability'
import { syncState } from '../services/staleness'
import { lookName, looksOfCharacter, looksUsingCostume } from '../services/looks'
import { parsePromptSections } from '../services/promptFormat'
import { chipClass } from './entity'
import { EpisodeStrip } from './EpisodeStrip'
import { SyncBadge } from './SyncBadge'
import { AppearanceSummary } from './AppearanceSummary'
import ui from '../styles/ui.module.css'
import s from './AssetList.module.css'

function roleLabel(role: Character['role']) {
  return role === 'lead' ? '主角' : role === 'support' ? '配角' : '龙套'
}

// 提示词摘要：去掉段标签，取正文首句 ~60 字，顶替被删掉的 description（决策 4b）。
function promptSummary(text: string): string {
  const secs = parsePromptSections(text)
  const body = (secs.find((x) => x.tag && x.tag !== '生成规格' && x.tag !== '着装融合')?.body ?? secs[0]?.body ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  return body.length > 64 ? body.slice(0, 64) + '…' : body
}

function firstText(fa: { episodeNo: number; sceneNo: number } | undefined): string {
  return fa ? `首现 ${fa.episodeNo}集${fa.sceneNo}场` : '未出场'
}

// 内联改名：点名字进编辑态，回车 / 失焦保存。仅 analysis 阶段可用（editAssetName）。
function EditableName({ id, name }: { id: string; name: string }) {
  const canRename = useStore((st) => can(st.project, 'editAssetName'))
  const rename = useStore((st) => st.renameAsset)
  const [editing, setEditing] = useState(false)
  const [v, setV] = useState(name)
  if (!canRename) return <span className={s.nm}>{name}</span>
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
    <span className={s.nm} title="点击改名" onClick={() => { setV(name); setEditing(true) }}>{name}</span>
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
  const promptBtn = (
    <button className={s.promptBtn} onClick={() => onOpenPrompt(asset.id)} title="查看 / 编辑完整提示词">
      提示词
    </button>
  )

  // ── 道具：单行紧凑 ──
  if (asset.kind === 'prop') {
    return (
      <div className={[s.row, s.rowProp, asset.excluded ? s.rowExcluded : ''].join(' ')}>
        <span className={[s.bar, s.barProp].join(' ')} />
        <EditableName id={asset.id} name={asset.name} />
        {asset.aliases?.length ? <span className={s.aliases}>「{asset.aliases.join('」「')}」</span> : null}
        <AppearanceSummary appearances={usage.appearances} shotCount={usage.shotCount} compact />
        <span className={s.rowRight}>
          <button
            className={s.exclBtn}
            disabled={!canExclude}
            onClick={() => toggleExcluded(asset.id)}
            title={asset.excluded ? '恢复出图' : '设为不出图'}
          >
            {asset.excluded ? '○ 不出图' : '● 待生成'}
          </button>
          {promptBtn}
        </span>
      </div>
    )
  }

  // ── 场景 ──
  if (asset.kind === 'location') {
    return (
      <div className={s.row}>
        <span className={[s.bar, s.barScene].join(' ')} />
        <div className={s.main}>
          <div className={s.head}>
            <EditableName id={asset.id} name={asset.name} />
            <span className={s.tag}>{asset.timeOfDay}</span>
            <span className={s.headRight}><SyncBadge state={syncState(asset)} /></span>
          </div>
          {asset.aliases?.length ? <div className={s.aliases}>别名「{asset.aliases.join('」「')}」</div> : null}
          <div className={s.summary}>「{promptSummary(asset.imagePrompt)}」{promptBtn}</div>
          <div className={s.appr}>
            <EpisodeStrip totalEpisodes={totalEpisodes} appearances={usage.appearances} />
            <AppearanceSummary appearances={usage.appearances} shotCount={usage.shotCount} />
          </div>
        </div>
      </div>
    )
  }

  // ── 服装：不显示归属，改为显示被哪些着装角色使用 ──
  if (asset.kind === 'costume') {
    const usedBy = looksUsingCostume(asset.id, assets)
    return (
      <div className={s.row}>
        <span className={[s.bar, s.barCloth].join(' ')} />
        <div className={s.main}>
          <div className={s.head}>
            <EditableName id={asset.id} name={asset.name} />
            <span className={s.headRight}><SyncBadge state={syncState(asset)} /></span>
          </div>
          {asset.aliases?.length ? <div className={s.aliases}>别名「{asset.aliases.join('」「')}」</div> : null}
          <div className={s.summary}>「{promptSummary(asset.imagePrompt)}」{promptBtn}</div>
          {usedBy.length > 0 && (
            <div className={s.usedBy}>
              <span className={s.usedLabel}>用于</span>
              {usedBy.map((lk) => (
                <span key={lk.id} className={[ui.chip, chipClass('look')].join(' ')}>
                  <span className={ui.odot} />
                  {lookName(lk, assets)}
                </span>
              ))}
            </div>
          )}
          <div className={s.appr}>
            <EpisodeStrip totalEpisodes={totalEpisodes} appearances={usage.appearances} />
            <AppearanceSummary appearances={usage.appearances} shotCount={usage.shotCount} />
            <span className={s.viaNote}>（经着装角色）</span>
          </div>
        </div>
      </div>
    )
  }

  // ── 角色（含着装角色子行）——此分支 asset 必为 Character（look 无独立 tab，不进 AssetList）──
  const character = asset as Character
  const looks = looksOfCharacter(character.id, assets)
  return (
    <div className={s.row}>
      <span className={[s.bar, s.barRole].join(' ')} />
      <div className={s.main}>
        <div className={s.head}>
          <EditableName id={character.id} name={character.name} />
          <span className={s.tag}>{roleLabel(character.role)}</span>
          <span className={s.first}>{firstText(usage.firstAppearance)}</span>
          <span className={s.headRight}><SyncBadge state={syncState(asset)} /></span>
        </div>
        {asset.aliases?.length ? <div className={s.aliases}>别名「{asset.aliases.join('」「')}」</div> : null}
        <div className={s.summary}>「{promptSummary(asset.imagePrompt)}」{promptBtn}</div>
        <div className={s.appr}>
          <EpisodeStrip totalEpisodes={totalEpisodes} appearances={usage.appearances} />
          <AppearanceSummary appearances={usage.appearances} shotCount={usage.shotCount} />
        </div>

        {looks.length > 0 && (
          <div className={s.lookGroup}>
            <div className={s.lookHead}>着装角色 {looks.length}</div>
            {looks.map((lk) => {
              const lu = usageIndex[lk.id] ?? { appearances: [], shotCount: 0 }
              return (
                <div className={s.lookRow} key={lk.id}>
                  <span className={s.lookChips} title="角色与服装的绑定由剧本分析确定，不可修改">
                    <span className={[ui.chip, chipClass('character')].join(' ')}>
                      <span className={ui.odot} />
                      {assets[lk.characterId]?.name ?? '未知角色'}
                    </span>
                    {lk.costumeIds.map((cid) => (
                      <span key={cid} className={[ui.chip, chipClass('costume')].join(' ')}>
                        <span className={ui.odot} />
                        {assets[cid]?.name ?? '未知服装'}
                      </span>
                    ))}
                    {lk.costumeIds.length === 0 && <span className={s.defaultLook}>默认着装</span>}
                  </span>
                  <span className={s.lookAppr}>
                    <AppearanceSummary appearances={lu.appearances} shotCount={lu.shotCount} compact />
                  </span>
                  <SyncBadge state={syncState(lk)} />
                  <button className={s.promptBtn} onClick={() => onOpenPrompt(lk.id)} title="查看 / 编辑着装角色提示词">
                    提示词
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
