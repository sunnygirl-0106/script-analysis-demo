import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/theme.css'
import './styles/global.css'
import './styles/analyzing.css'
import App from './App.tsx'
import { useStore } from './store/useStore'
import { seedCandidates, seedFreshProject } from './data/seed'

// v2.0：两种演示起点（不做 UI 开关，用 URL query 切换）。
//   默认        = 已入库 + 有分镜（现状，直接看分镜表）
//   ?fresh=1    = 首次导入：未入库 + 无分镜 + 全部资产在 candidates，从阶段② 完整确认页起步
if (new URLSearchParams(window.location.search).get('fresh') === '1') {
  useStore.setState({
    project: structuredClone(seedFreshProject),
    candidates: structuredClone(seedCandidates),
    analysisStep: 'assetConfirm',
    analysisPhase: 'done',
    activeTab: 'character',
    promptStates: {},
    promptEdited: {},
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
