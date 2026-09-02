import { useStore } from './store/useStore'
import { AppShell } from './layout/AppShell'
import { ScriptAnalysis } from './pages/ScriptAnalysis'
import { AssetConfirm } from './pages/AssetConfirm'
import { EmptyScriptState } from './pages/EmptyScriptState'
import { AnalyzingWorkspace } from './pages/AnalyzingWorkspace'
import { VisualPrep } from './pages/VisualPrep'
import { Studio } from './pages/Studio'
import { Toast } from './components/Toast'

// 上传四拍（v2.3 §二）：空态 / 预估中 / 确认弹窗都停在空态页（各拍由 EmptyScriptState 内部切换）；
// 点确认后进 analyzing（AnalyzingWorkspace 只跑一段解析进度，跑完直接落阶段② 资产确认页）。
export default function App() {
  const activePage = useStore((s) => s.activePage)
  const analysisPhase = useStore((s) => s.analysisPhase)
  const analysisStep = useStore((s) => s.analysisStep)

  const analysisContent =
    analysisPhase === 'empty' || analysisPhase === 'estimating' || analysisPhase === 'confirm' ? (
      <EmptyScriptState />
    ) : analysisPhase === 'analyzing' ? (
      <AnalyzingWorkspace />
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
