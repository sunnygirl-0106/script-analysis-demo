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
  const toggleSkip = useStore((st) => st.toggleSkipImageGen)
  const toggleMinor = useStore((st) => st.toggleMinorProp)

  const costumes =
    asset.kind === 'character'
      ? Object.values(assets).filter((x): x is Costume => x.kind === 'costume' && x.characterId === asset.id)
      : []

  return (
    <div className={s.card}>
      <div className={s.h}>
        <span className={s.nm}>{asset.name}</span>
        {asset.kind === 'character' && <span className={s.tg}>{roleLabel(asset.role)}</span>}
        {asset.kind === 'location' && <span className={s.tg}>{asset.timeOfDay}</span>}
        {asset.kind === 'character' && asset.skipImageGen ? (
          <span className={[s.rt, s.voice].join(' ')}>仅声音 · 已排除生图</span>
        ) : (
          <span className={s.rt}>{apprText(asset)}</span>
        )}
      </div>

      <div className={s.bio}>{asset.description}</div>

      {/* 角色：列出服装 + 不生图开关 */}
      {asset.kind === 'character' && (
        <>
          {costumes.length > 0 && <div className={s.hr} />}
          {costumes.map((c) => (
            <div className={s.wr} key={c.id}>
              <span className={[ui.chip, chipClass('costume')].join(' ')}>
                <span className={ui.odot} />
                {c.name}
              </span>
              <span className={s.rt}>{apprText(c)}</span>
            </div>
          ))}
          <div className={s.toggle} onClick={() => toggleSkip(asset.id)} title="切换是否进入生图队列">
            <span className={[s.switch, asset.skipImageGen ? s.on : ''].join(' ')} />
            {asset.skipImageGen ? '这个人不用生图（已跳过）' : '纳入生图队列'}
          </div>
        </>
      )}

      {/* 道具：次要道具可跳过生图 */}
      {asset.kind === 'prop' && (
        <div className={s.toggle} onClick={() => toggleMinor(asset.id)} title="切换是否为次要道具">
          <span className={[s.switch, asset.minor ? s.on : ''].join(' ')} />
          {asset.minor ? '次要道具（跳过生图）' : '纳入生图队列'}
        </div>
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
