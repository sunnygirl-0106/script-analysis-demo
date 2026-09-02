import type { ReactNode } from 'react'
import { useStore } from '../store/useStore'
import type { Stage } from '../data/types'
import { StepBar } from '../components/StepBar'
import s from './AppShell.module.css'

// 左侧导航图标（内联 line icon，跟随 currentColor）
const icons: Record<string, ReactNode> = {
  quick: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M4 11.5 12 5l8 6.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10.5V19h12v-8.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  analysis: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="4" y="4" width="7" height="7" rx="1.2" />
      <rect x="13" y="4" width="7" height="7" rx="1.2" />
      <rect x="4" y="13" width="7" height="7" rx="1.2" />
      <rect x="13" y="13" width="7" height="7" rx="1.2" />
    </svg>
  ),
  assets: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="7" cy="6" r="2.2" />
      <circle cx="17" cy="6" r="2.2" />
      <circle cx="12" cy="18" r="2.2" />
      <path d="M7 8.2v3.3a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V8.2M12 13.5v2.3" strokeLinecap="round" />
    </svg>
  ),
  studio: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M10 9.2 15 12l-5 2.8V9.2Z" strokeLinejoin="round" />
    </svg>
  ),
  models: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="9" cy="9" r="3" />
      <path d="M3.5 19c.6-3 2.9-4.6 5.5-4.6s4.9 1.6 5.5 4.6" strokeLinecap="round" />
      <path d="M16 6.2A3 3 0 0 1 16 12M17.5 14.6c1.9.5 3.3 1.9 3.7 4.4" strokeLinecap="round" />
    </svg>
  ),
}

type NavKey = 'quick' | 'analysis' | 'assets' | 'studio' | 'models'
const navItems: { key: NavKey; label: string; page?: Stage }[] = [
  { key: 'quick', label: '快捷创作' },
  { key: 'analysis', label: '剧本分析', page: 'analysis' },
  { key: 'assets', label: '项目资产库' },
  { key: 'studio', label: '拍摄台', page: 'studio' },
  { key: 'models', label: '模型对话广场' },
]

export function AppShell({ children }: { children: ReactNode }) {
  // 只订阅真正用到的三个原始值。订阅整个 project 会让「改一个镜头的一个字符」
  // 冒泡成整棵 App 树重渲染——AppShell 是所有页面的父节点。
  const title = useStore((st) => st.project.title)
  const aspect = useStore((st) => st.project.aspect)
  const style = useStore((st) => st.project.style)
  const activePage = useStore((st) => st.activePage)
  const setPage = useStore((st) => st.setPage)
  const navCollapsed = useStore((st) => st.navCollapsed)
  const toggleNav = useStore((st) => st.toggleNav)
  const analysisView = useStore((st) => st.analysisView)
  const replayDemo = useStore((st) => st.replayDemo)
  const finishOrganize = useStore((st) => st.finishOrganize)
  const finishExtract = useStore((st) => st.finishExtract)
  const finishSplit = useStore((st) => st.finishSplit)

  // 演示控制器 pill：三段整页动效里都能「跳过」直达该段的结果；跑完可「重新演示」复位重播。
  // 空态不显示 pill（空态自带 CTA）。
  const skip =
    analysisView === 'organizing' ? finishOrganize
    : analysisView === 'extracting' ? finishExtract
    : analysisView === 'splitting' ? finishSplit
    : null
  const demoPill =
    activePage === 'analysis' && analysisView !== 'empty' ? (
      skip ? (
        <button className={s.demoPill} onClick={skip}>
          跳过 ⏭
        </button>
      ) : (
        <button className={[s.demoPill, s.demoPillReplay].join(' ')} onClick={replayDemo}>
          ▶ 重新演示
        </button>
      )
    ) : null

  const aspectLabel = aspect === '16:9' ? '16:9 横屏' : '9:16 竖屏'
  const styleLabel = style === 'realistic' ? '写实' : '电影感'

  return (
    <div className={s.wrap}>
      <div className={s.app}>
        {/* 顶栏：Logo + 账户区 */}
        <div className={s.topbar}>
          <div className={s.logo}>
            <img className={s.logoMark} src="/logo.svg" alt="PhanthyMovie" />
            PhanthyMovie
          </div>
          <div className={s.right}>
            {demoPill}
            <span className={s.recharge}>充值中心</span>
            <span className={s.credits}>✦ 10</span>
            <span className={s.bell}>
              🔔<i className={s.badge}>1</i>
            </span>
            <span className={s.avatar} />
          </div>
        </div>

        <div className={s.body}>
          {/* 左侧一级导航 */}
          <div className={[s.nav, navCollapsed ? s.collapsed : ''].join(' ')}>
            <div className={s.proj}>
              <div className={s.projTitle}>
                <span className={s.back}>‹</span>
                {title}
              </div>
              <div className={s.chips}>
                <span className={s.chip}>{aspectLabel}</span>
                <span className={s.chip}>{styleLabel}</span>
              </div>
            </div>

            <div className={s.modeCard}>
              <div className={s.modeLabel}>当前模式</div>
              <div className={s.modeRow}>
                <b>工作流</b>
                <span className={s.modeSwitch}>切换模式</span>
              </div>
            </div>

            <div className={s.navList}>
              {navItems.map((it) => {
                const on = it.page != null && it.page === activePage
                return (
                  <div
                    key={it.key}
                    className={[s.navItem, on ? s.on : ''].join(' ')}
                    onClick={it.page ? () => setPage(it.page!) : undefined}
                  >
                    <span className={s.navIcon}>{icons[it.key]}</span>
                    <span className={s.navText}>{it.label}</span>
                  </div>
                )
              })}
            </div>

            <button
              className={s.collapseBtn}
              onClick={toggleNav}
              title={navCollapsed ? '展开侧栏' : '收起侧栏'}
              aria-label={navCollapsed ? '展开侧栏' : '收起侧栏'}
            >
              {navCollapsed ? '›' : '‹'}
            </button>
          </div>

          <div className={s.content}>
            {(activePage === 'analysis' || activePage === 'visual') && <StepBar />}
            <div className={s.contentBody}>{children}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
