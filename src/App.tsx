import { useStore } from './store/useStore'
import { AppShell } from './layout/AppShell'
import { ScriptAnalysis } from './pages/ScriptAnalysis'
import { AssetConfirm } from './pages/AssetConfirm'
import { EpisodeOrganize } from './pages/EpisodeOrganize'
import { EmptyScriptState } from './pages/EmptyScriptState'
import { FullPageProcess } from './pages/FullPageProcess'
import { VisualPrep } from './pages/VisualPrep'
import { Studio } from './pages/Studio'
import { Toast } from './components/Toast'

// 剧本分析的子页分派：一个 analysisView 决定一屏（见 data/types.ts 的 AnalysisView）。
// 三个「…ing」都落到同一个整页动效组件，各自跑完跨到下一屏。
function analysisScreen(view: ReturnType<typeof useStore.getState>['analysisView']) {
  switch (view) {
    case 'empty':
      return <EmptyScriptState />
    case 'organizing':
    case 'extracting':
    case 'splitting':
      return <FullPageProcess />
    case 'episodes':
      return <EpisodeOrganize />
    case 'assetConfirm':
      return <AssetConfirm />
    case 'storyboard':
      return <ScriptAnalysis />
  }
}

export default function App() {
  const activePage = useStore((s) => s.activePage)
  const analysisView = useStore((s) => s.analysisView)

  return (
    <AppShell>
      {activePage === 'analysis' && analysisScreen(analysisView)}
      {activePage === 'visual' && <VisualPrep />}
      {activePage === 'studio' && <Studio />}
      <Toast />
    </AppShell>
  )
}
