// 手动编辑角标用的铅笔图标。笔身从右上到左下倾斜、笔尖在左下（Feather「edit-2」的画法）。
// width/height 用 1em，颜色走 currentColor —— 大小随字号、颜色随外层（如角标的琥珀色）。
export function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  )
}
