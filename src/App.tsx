import { useEffect } from 'react'
import { useStore } from './store/useStore'
import { AppShell } from './layout/AppShell'
import { ScriptAnalysis } from './pages/ScriptAnalysis'
import { VisualPrep } from './pages/VisualPrep'
import { Studio } from './pages/Studio'
import { Toast } from './components/Toast'

export default function App() {
  const theme = useStore((s) => s.theme)
  const activePage = useStore((s) => s.activePage)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  return (
    <AppShell>
      {activePage === 'analysis' && <ScriptAnalysis />}
      {activePage === 'visual' && <VisualPrep />}
      {activePage === 'studio' && <Studio />}
      <Toast />
    </AppShell>
  )
}
