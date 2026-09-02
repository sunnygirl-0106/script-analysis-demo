import { useStore } from './store/useStore'
import { AppShell } from './layout/AppShell'
import { ScriptAnalysis } from './pages/ScriptAnalysis'
import { AssetConfirm } from './pages/AssetConfirm'
import { EpisodeOrganize } from './pages/EpisodeOrganize'
import { SplitStart } from './pages/SplitStart'
import { EmptyScriptState } from './pages/EmptyScriptState'
import { AnalyzingWorkspace } from './pages/AnalyzingWorkspace'
import { VisualPrep } from './pages/VisualPrep'
import { Studio } from './pages/Studio'
import { Toast } from './components/Toast'

// 剧本分析的子页分派（v2.4 §5.1）。两个维度：
//   analysisPhase —— 上传演示的呈现相位（空态 / 整理中 / 提取中 / 完成），它优先；
//   analysisStep  —— 四步流程走到哪一步。
// 步骤③ 有两副面孔：还没拆是 SplitStart 起点页，拆完才是分镜表。
export default function App() {
  const activePage = useStore((s) => s.activePage)
  const analysisPhase = useStore((s) => s.analysisPhase)
  const analysisStep = useStore((s) => s.analysisStep)
  const hasShots = useStore((s) => Object.keys(s.project.shots).length > 0)

  const analysisContent =
    analysisPhase === 'empty' || analysisPhase === 'organizing' ? (
      <EmptyScriptState />
    ) : analysisPhase === 'extracting' ? (
      <AnalyzingWorkspace />
    ) : analysisStep === 'episodes' ? (
      <EpisodeOrganize />
    ) : analysisStep === 'assetConfirm' ? (
      <AssetConfirm />
    ) : hasShots ? (
      <ScriptAnalysis />
    ) : (
      <SplitStart />
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
