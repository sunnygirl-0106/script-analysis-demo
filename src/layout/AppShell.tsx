import type { ReactNode } from 'react'
import { useStore } from '../store/useStore'
import s from './AppShell.module.css'

export function AppShell({ children }: { children: ReactNode }) {
  const project = useStore((st) => st.project)
  const theme = useStore((st) => st.theme)
  const activePage = useStore((st) => st.activePage)
  const toggleTheme = useStore((st) => st.toggleTheme)
  const setPage = useStore((st) => st.setPage)

  const aspectLabel = project.aspect === '16:9' ? '16:9 横屏' : '9:16 竖屏'
  const styleLabel = project.style === 'realistic' ? '写实' : '电影感'

  return (
    <div className={s.wrap}>
      <div className={s.app}>
        {/* 顶栏：Logo + 项目信息 + 主题切换 */}
        <div className={s.topbar}>
          <div className={s.logo}>PhanthyMovie</div>
          <div className={s.right}>
            <span>
              {project.title} · {aspectLabel} · {styleLabel} · ✦ 2000
            </span>
            <button className={s.themeBtn} onClick={toggleTheme}>
              {theme === 'dark' ? '☀ 浅色' : '🌙 深色'}
            </button>
          </div>
        </div>

        <div className={s.body}>
          {/* 左侧一级导航 */}
          <div className={s.nav}>
            <div className={s.navItem}>
              快捷
              <br />
              创作
            </div>
            <div
              className={[s.navItem, activePage === 'analysis' ? s.on : ''].join(' ')}
              onClick={() => setPage('analysis')}
            >
              剧本
              <br />
              分析
            </div>
            <div
              className={[s.navItem, activePage === 'visual' ? s.on : ''].join(' ')}
              onClick={() => setPage('visual')}
            >
              视觉
              <br />
              筹备
            </div>
            <div
              className={[s.navItem, activePage === 'studio' ? s.on : ''].join(' ')}
              onClick={() => setPage('studio')}
            >
              拍摄台
            </div>
            <div className={s.navItem}>
              模型
              <br />
              广场
            </div>
          </div>

          <div className={s.content}>{children}</div>
        </div>
      </div>
    </div>
  )
}
