import type { ReactNode } from 'react'

// 菜单与行内按钮的描边小图标。统一 24×24 viewBox、15px 呈现、1.7 描边。
//
// 收在一处的理由很实在：这个 svg() 包装器此前在 EpisodeTree 和 EpisodeOrganize 里
// 各写了一遍（后者的注释还写着「沿用 EpisodeTree 里那套」），trash 那条 path
// 更是在 EpisodeTree 和 ShotRow 里逐字抄了两份。图标一旦要改风格，就得记得改几处。
const svg = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth={1.7}>
    {d}
  </svg>
)

export const ic = {
  rename: svg(
    <>
      <path d="M4 20h4L19 9a2 2 0 0 0-3-3L5 17v3z" strokeLinejoin="round" />
      <path d="M14 7l3 3" strokeLinecap="round" />
    </>,
  ),
  insert: svg(
    <>
      <path d="M4 9h16" strokeLinecap="round" />
      <path d="M12 13.5v6M9 16.5h6" strokeLinecap="round" />
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
}
