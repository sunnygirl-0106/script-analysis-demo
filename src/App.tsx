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

// 剧本分析的子页分派（v2.5 §三）。两个维度：
//   analysisPhase —— 呈现相位（空态 / 整理中 / 提取中 / 拆分中 / 完成），它优先；
//   analysisStep  —— 三步流程走到哪一步。
// 三个「中」相位都落到同一个整页动效组件，各自跑完跨到下一步。
export default function App() {
  const activePage = useStore((s) => s.activePage)
  const analysisPhase = useStore((s) => s.analysisPhase)
  const analysisStep = useStore((s) => s.analysisStep)

  const analysisContent =
    analysisPhase === 'empty' ? (
      <EmptyScriptState />
    ) : analysisPhase !== 'done' ? (
      <FullPageProcess />
    ) : analysisStep === 'episodes' ? (
      <EpisodeOrganize />
    ) : analysisStep === 'assetConfirm' ? (
      <AssetConfirm />
    ) : (
      <ScriptAnalysis />
    )

  return (
    <AppShell>
      {activePage === 'analysis' && analysisContent}
      {activePage === 'visual' && <VisualPrep />}
      {activePage === 'studio' && <Studio />}
      <Toast />
    </AppShell>
  )
}
