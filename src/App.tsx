import { useEffect } from 'react'
import { useStore } from './store/useStore'
import { AppShell } from './layout/AppShell'
import { ScriptAnalysis } from './pages/ScriptAnalysis'
import { EmptyScriptState } from './pages/EmptyScriptState'
import { AnalyzingWorkspace } from './pages/AnalyzingWorkspace'
import { VisualPrep } from './pages/VisualPrep'
import { Studio } from './pages/Studio'
import { Toast } from './components/Toast'
import { ASSET_TAB_AT, DONE_AT, STAGE_AT, UPLOAD_MS } from './services/analysisTimeline'

// 拆解过程演示的时间线控制器：监听 analysisPhase，按 analysisTimeline 推进 revealStage，
// 并在阶段边界顺带编排「本场剧本展开 / 资产 tab 切换 / 落地回分镜」。所有定时器在相位切换时清理。
function useAnalysisReveal() {
  const phase = useStore((s) => s.analysisPhase)
  const setPhase = useStore((s) => s.setAnalysisPhase)
  const setRevealStage = useStore((s) => s.setRevealStage)
  const setTab = useStore((s) => s.setTab)
  const setScriptOpen = useStore((s) => s.setScriptOpen)

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const timers: number[] = []
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms))

    if (phase === 'uploading') {
      // 减弱动态：跳过整段动画，直接落到完整页。
      if (reduce) {
        at(150, () => setPhase('done'))
      } else {
        at(UPLOAD_MS, () => {
          setRevealStage(0)
          setScriptOpen(false)
          setTab('shot')
          setPhase('analyzing')
        })
      }
    } else if (phase === 'analyzing') {
      if (reduce) {
        setPhase('done')
      } else {
        STAGE_AT.forEach((ms, i) =>
          at(ms, () => {
            setRevealStage(i)
            if (i >= 2) setScriptOpen(true) // 本场剧本展开
          }),
        )
        // 资产阶段：依次扫过角色·服装·场景·道具，逐类呈现，拆解更完整。
        ASSET_TAB_AT.forEach(({ tab, at: ms }) => at(ms, () => setTab(tab)))
        // 落地：切回分镜脚本作为完整页的默认视图。
        at(DONE_AT, () => {
          setTab('shot')
          setPhase('done')
        })
      }
    }

    return () => timers.forEach((t) => clearTimeout(t))
  }, [phase, setPhase, setRevealStage, setTab, setScriptOpen])
}

export default function App() {
  const activePage = useStore((s) => s.activePage)
  const analysisPhase = useStore((s) => s.analysisPhase)

  useAnalysisReveal()

  const analysisContent =
    analysisPhase === 'empty' || analysisPhase === 'uploading' ? (
      <EmptyScriptState />
    ) : analysisPhase === 'analyzing' ? (
      <AnalyzingWorkspace />
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
