import { useStore, type Tab } from '../store/useStore'
import type { Scene } from '../data/types'
import s from './TabBar.module.css'

export function TabBar({ scene }: { scene: Scene | undefined }) {
  const activeTab = useStore((st) => st.activeTab)
  const setTab = useStore((st) => st.setTab)
  const assets = useStore((st) => st.project.assets)

  const count = (fn: (kind: string) => boolean) => Object.values(assets).filter((a) => fn(a.kind)).length
  const tabs: { key: Tab; label: string; n: number }[] = [
    { key: 'character', label: '人物', n: count((k) => k === 'character') },
    { key: 'location', label: '场景', n: count((k) => k === 'location') },
    { key: 'prop', label: '道具', n: count((k) => k === 'prop') },
    { key: 'shot', label: '分镜脚本', n: scene?.shotIds.length ?? 0 },
  ]

  return (
    <div className={s.tabs}>
      {tabs.map((t) => (
        <button
          key={t.key}
          className={[s.tab, activeTab === t.key ? s.on : ''].join(' ')}
          onClick={() => setTab(t.key)}
        >
          {t.label}
          <i className={s.count}>{t.n}</i>
        </button>
      ))}
    </div>
  )
}
