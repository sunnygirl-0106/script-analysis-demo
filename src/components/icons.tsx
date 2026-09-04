import type { ReactNode } from 'react'

// 菜单与行内按钮的描边小图标。统一 24×24 viewBox、15px 呈现、1.7 描边。
//
// 收在一处的理由很实在：这个 svg() 包装器此前在 EpisodeTree 和 EpisodeOrganize 里
// 各写了一遍（后者的注释还写着「沿用 EpisodeTree 里那套」），trash 那条 path
// 更是在 EpisodeTree 和 ShotRow 里逐字抄了两份。图标一旦要改风格，就得记得改几处。
const svg = (d: ReactNode, size = 16) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.7}>
    {d}
  </svg>
)

// 实心版包装：▶ / ⏭ / ✦ 这几个原本是实心字符，描边画出来会变成空心轮廓，分量全丢。
const solid = (d: ReactNode, size = 16) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
    {d}
  </svg>
)

// 场记板的形状两个尺寸共用一份，别抄第二遍。
const CLAPPER = (
  <>
    <rect x="3" y="9.2" width="18" height="11.3" rx="1.6" />
    <path d="M3.4 9.2 5.1 4.2l16.1 1.9-.9 3.1" strokeLinejoin="round" />
    <path d="M9.1 4.6 7.6 9.2M14.4 5.2l-1.5 4" strokeLinecap="round" />
  </>
)

export const ic = {
  rename: svg(
    <>
      <path d="M4 20h4L19 9a2 2 0 0 0-3-3L5 17v3z" strokeLinejoin="round" />
      <path d="M14 7l3 3" strokeLinecap="round" />
    </>,
  ),
  resplit: svg(
    <>
      <circle cx="6.5" cy="7" r="2" />
      <circle cx="6.5" cy="17" r="2" />
      <path d="M8.3 8.1 20 15.5M8.3 15.9 20 8.5" strokeLinecap="round" />
    </>,
  ),
  trash: svg(
    <path d="M5 7h14M10 7V5h4v2M6 7l1 12h10l1-12" strokeLinecap="round" strokeLinejoin="round" />,
  ),
  upload: svg(
    <>
      <path d="M12 16V5" strokeLinecap="round" />
      <path d="M8 8.6 12 4.6l4 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 18.5h15" strokeLinecap="round" />
    </>,
  ),
  add: svg(
    <>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </>,
  ),
  download: svg(
    <>
      <path d="M12 4v11" strokeLinecap="round" />
      <path d="M8 11.4 12 15.4l4-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 19.5h15" strokeLinecap="round" />
    </>,
  ),
  /* 导出：从框里往外送。跟 download（往下落盘）区分开——分镜表那个按钮做的是「导出脚本」。 */
  exportOut: svg(
    <>
      <path d="M12 14V4" strokeLinecap="round" />
      <path d="M8.5 7.2 12 3.7l3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 12v6.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V12" strokeLinecap="round" strokeLinejoin="round" />
    </>,
  ),
  /* 只看这一场：四角取景框。 */
  focus: svg(
    <>
      <path d="M4 9V5.5a1 1 0 0 1 1-1H9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 4.5h4a1 1 0 0 1 1 1V9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 15v3.5a1 1 0 0 1-1 1H15" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 19.5H5a1 1 0 0 1-1-1V15" strokeLinecap="round" strokeLinejoin="round" />
    </>,
  ),

  /* ── 替掉 emoji / 字符图标的那一批（v2.10）──
     原来这些位置写的是 ✕ ✓ ⚠ ⚙ 🔔 🔒 ▶ ⏭ ✦ ⌄ ⌕ 这类字符：
     它们的字形、粗细、基线全跟着系统字体走，Mac 和 Windows 上不是一个东西，
     跟旁边 1.7 描边的 svg 图标也对不上；emoji 那两个还是彩色位图，颜色根本不受控。 */
  /* ⋯ 更多操作：三个实心圆点。描边版画出来是三个小圆环，远看像省略号里掉了墨。 */
  more: solid(
    <>
      <circle cx="5.6" cy="12" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="18.4" cy="12" r="1.75" />
    </>,
  ),
  close: svg(<path d="M6.4 6.4 17.6 17.6M17.6 6.4 6.4 17.6" strokeLinecap="round" />),
  check: svg(<path d="M5 12.6 9.6 17.2 19 7.8" strokeLinecap="round" strokeLinejoin="round" />),
  warn: svg(
    <>
      <path d="M12 4.4 21 19.6H3L12 4.4z" strokeLinejoin="round" />
      <path d="M12 10v4.1" strokeLinecap="round" />
      <circle cx="12" cy="17" r="0.95" fill="currentColor" stroke="none" />
    </>,
  ),
  bell: svg(
    <>
      <path d="M6.6 16.8V11a5.4 5.4 0 0 1 10.8 0v5.8" strokeLinecap="round" />
      <path d="M4.8 16.8h14.4" strokeLinecap="round" />
      <path d="M10.1 19.4a2 2 0 0 0 3.8 0" strokeLinecap="round" />
    </>,
  ),
  lock: svg(
    <>
      <rect x="5" y="10.4" width="14" height="9.2" rx="1.8" />
      <path d="M8.4 10.4V7.9a3.6 3.6 0 0 1 7.2 0v2.5" strokeLinecap="round" />
    </>,
  ),
  gear: svg(
    <>
      <circle cx="12" cy="12" r="3.1" />
      <path
        d="M12 3.4v2.3M12 18.3v2.3M20.6 12h-2.3M5.7 12H3.4M18.1 5.9l-1.6 1.6M7.5 16.5l-1.6 1.6M18.1 18.1l-1.6-1.6M7.5 7.5 5.9 5.9"
        strokeLinecap="round"
      />
    </>,
  ),
  search: svg(
    <>
      <circle cx="10.7" cy="10.7" r="5.7" />
      <path d="M14.9 14.9 19.8 19.8" strokeLinecap="round" />
    </>,
  ),
  caretDown: svg(<path d="M6.6 9.6 12 15l5.4-5.4" strokeLinecap="round" strokeLinejoin="round" />),
  caretRight: svg(<path d="M9.6 6.6 15 12l-5.4 5.4" strokeLinecap="round" strokeLinejoin="round" />),
  play: solid(<path d="M8 5.4 19 12 8 18.6z" />),
  skipNext: solid(
    <>
      <path d="M5.6 5.4 15 12 5.6 18.6z" />
      <rect x="16.4" y="5.4" width="2.4" height="13.2" rx="1.1" />
    </>,
  ),
  /* 场记板：拍摄台占位页用的是 40px 的大号（icLg.clapper），这里留 16px 的常规档。 */
  clapper: svg(CLAPPER),
  /* ✦ 星火：AI 生成 / 星钻计价都用它。四角星，实心才有「一点火光」的意思。 */
  spark: solid(<path d="M12 2.6 14 10 21.4 12 14 14 12 21.4 10 14 2.6 12 10 10z" />),

  // ── 四类资产的类目图标（步骤② 的 tab）──
  kindCharacter: svg(
    <>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5 20c0-3.6 3.1-5.6 7-5.6s7 2 7 5.6" strokeLinecap="round" />
    </>,
  ),
  kindCostume: svg(
    <>
      <path d="M9 4.5 12 7l3-2.5 4 2.2-1.6 3.6-1.6-.7V19.5H7.2V9.6l-1.6.7L4 6.7 9 4.5z" strokeLinejoin="round" />
    </>,
  ),
  kindLocation: svg(
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="1.6" />
      <path d="M3.9 16.2 9 11.4l3.4 3.2L15.6 12l4.5 4.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="8.6" cy="9" r="1.3" />
    </>,
  ),
  kindProp: svg(
    <>
      <path d="M12 3.6 20 8v8l-8 4.4L4 16V8l8-4.4z" strokeLinejoin="round" />
      <path d="M4.3 8 12 12.2 19.7 8M12 12.2v8.2" strokeLinejoin="round" />
    </>,
  ),
}

// 大号档：整页空态里当主视觉用，描边跟着放细一点，40px 上 1.7 会显得笨重。
export const icLg = {
  clapper: (
    <svg viewBox="0 0 24 24" width={40} height={40} fill="none" stroke="currentColor" strokeWidth={1.4}>
      {CLAPPER}
    </svg>
  ),
}
