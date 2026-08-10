import type { ReactNode } from 'react'
import type { Stage } from '../data/types'
import { useStore } from '../store/useStore'
import s from './AppShell.module.css'

const STAGES: { key: Stage; label: string }[] = [
  { key: 'analysis', label: '剧本分析' },
  { key: 'visual', label: '视觉筹备' },
  { key: 'studio', label: '拍摄台' },
]

const STAGE_RANK: Record<Stage, number> = { analysis: 0, visual: 1, studio: 2 }

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
        {/* 顶栏：三阶段流程条 + 主题切换 */}
        <div className={s.topbar}>
          <div className={s.logo}>PhanthyMovie</div>
          <div className={s.flow}>
            {STAGES.map((st, i) => {
              const rank = STAGE_RANK[st.key]
              const cur = activePage === st.key
              const done = rank < STAGE_RANK[project.stage]
              return (
                <span key={st.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                  {i > 0 && <span className={s.flowArrow}>→</span>}
                  <span
                    className={[s.flowStep, cur ? s.cur : '', done ? s.done : ''].join(' ')}
                    onClick={() => setPage(st.key)}
                  >
                    <span className={s.dot} />
                    {st.label}
                  </span>
                </span>
              )
            })}
          </div>
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
