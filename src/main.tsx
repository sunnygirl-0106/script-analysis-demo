import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/theme.css'
import './styles/global.css'
import './styles/analyzing.css'
import App from './App.tsx'
import { useStore } from './store/useStore'
import { seedFreshProject } from './data/seed'

// 两种演示起点（不做 UI 开关，用 URL query 切换）。
//   默认        = 空项目 + 空态页：什么都没有，点「＋ 上传剧本」从头走一遍（v2.6 §1.2）
//   ?fresh=1    = 刚整理完剧本：有集有正文，未入库、无场无镜、库为空，从步骤① 整理剧本页起步
if (new URLSearchParams(window.location.search).get('fresh') === '1') {
  useStore.setState({
    project: structuredClone(seedFreshProject),
    candidates: [],
    analysisStep: 'episodes',
    analysisPhase: 'done',
    promptStates: {},
    promptEdited: {},
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
