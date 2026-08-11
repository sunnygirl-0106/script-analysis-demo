import { useState } from 'react'
import { useStore } from '../store/useStore'
import type { Asset, Character, Costume } from '../data/types'
import { chipClass } from './entity'
import ui from '../styles/ui.module.css'
import s from './AssetGrid.module.css'

function roleLabel(role: Character['role']) {
  return role === 'lead' ? '主角' : role === 'support' ? '配角' : '龙套'
}

function apprText(a: Asset) {
  if (a.appearances.length === 0) return '未在任何镜头出现'
  return a.appearances.map((ap) => `${ap.episodeNo}集${ap.sceneNo}场`).join(' · ')
}

export function AssetCard({ asset }: { asset: Asset }) {
  const [showPrompt, setShowPrompt] = useState(false)
  const assets = useStore((st) => st.project.assets)

  const costumes =
    asset.kind === 'character'
      ? Object.values(assets).filter((x): x is Costume => x.kind === 'costume' && x.characterId === asset.id)
      : []

  return (
    <div className={s.card}>
      <div className={s.h}>
        <span className={s.nm}>{asset.name}</span>
        {asset.kind === 'character' && <span className={s.tg}>{roleLabel(asset.role)}</span>}
        {asset.kind === 'costume' && (
          <span className={s.tg}>属于 · {assets[asset.characterId]?.name ?? '（未知）'}</span>
        )}
        {asset.kind === 'location' && <span className={s.tg}>{asset.timeOfDay}</span>}
        <span className={s.rt}>{apprText(asset)}</span>
      </div>

      <div className={s.bio}>{asset.description}</div>

      {/* 角色：列出服装（谁穿哪件的关系视图）*/}
      {asset.kind === 'character' && costumes.length > 0 && (
        <>
          <div className={s.hr} />
          {costumes.map((c) => (
            <div className={s.wr} key={c.id}>
              <span className={[ui.chip, chipClass('costume')].join(' ')}>
                <span className={ui.odot} />
                {c.name}
              </span>
              <span className={s.rt}>{apprText(c)}</span>
            </div>
          ))}
        </>
      )}

      {/* 生图提示词折叠 */}
      <div>
        <div className={s.fold} onClick={() => setShowPrompt((v) => !v)}>
          {showPrompt ? '▾' : '▸'} 生图提示词
        </div>
        {showPrompt && <div className={s.foldc}>{asset.imagePrompt}</div>}
      </div>
    </div>
  )
}
