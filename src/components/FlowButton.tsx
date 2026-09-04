import type { ReactNode } from 'react'
import { ic } from './icons'
import s from './FlowButton.module.css'

// 三步页脚的终点按钮（设计稿「流光描边 1b」）。
// 每一页的页脚都只有一个「走完这一步」的出口，这颗按钮就是那个出口；
// 同页其它按钮（取消 / 新建资产 / 导出）仍用通用 .btn，靠这颗的实心与流光拉开轻重。
//
// 三处用法：
//   步骤① 资产提取 · ✦N        步骤② 确认资产并开始拆分        步骤③ 生成全部提示词 · ✦N
// 价钱不写进文案而走 cost：按钮里那颗 ✦ 已经是星钻的单位符号，
// 数字用一条细分隔线隔在右边，比「· ✦40」这样跟正文黏在一起好认。

export function FlowButton({
  children,
  onClick,
  disabled,
  busy,
  cost,
  icon = 'spark',
  title,
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  /** 处理中：光环停转、✦ 换成转圈。按钮同时不可点。 */
  busy?: boolean
  /** 星钻价。给了才渲染右侧的分隔线与数字。 */
  cost?: number
  /** 左侧 ✦（默认，AI 动作）/ 右侧 →（跳转到别处，隔几秒轻推一下）/ 都不要。 */
  icon?: 'spark' | 'arrow' | 'none'
  title?: string
}) {
  const dead = disabled || busy
  return (
    <div className={[s.rim, busy ? s.still : '', disabled ? s.off : ''].join(' ')}>
      <span className={s.orbit} aria-hidden />
      <button
        className={[s.btn, busy ? s.busy : ''].join(' ')}
        disabled={dead}
        title={title}
        onClick={onClick}
      >
        {busy ? (
          <span className={s.spin} aria-hidden />
        ) : (
          icon === 'spark' && <span className={s.spark}>{ic.spark}</span>
        )}
        <span>{children}</span>
        {icon === 'arrow' && !busy && (
          <span className={s.arrow} aria-hidden>
            →
          </span>
        )}
        {cost != null && !busy && (
          <>
            <span className={s.sep} aria-hidden />
            <span className={s.cost}>{cost}</span>
          </>
        )}
      </button>
    </div>
  )
}

/** 同一根页脚上的旁路出口：一条灰字链（步骤③「直接去资产库生图 →」）。
 *  跟主按钮不是一对平级选择，所以不给它描边、不给它常驻动效——hover 时箭头往前挪一点就够。 */
export function FlowLink({
  children,
  onClick,
  title,
}: {
  children: ReactNode
  onClick?: () => void
  title?: string
}) {
  return (
    <button className={s.link} title={title} onClick={onClick}>
      <span>{children}</span>
      <span className={s.linkArrow} aria-hidden>
        →
      </span>
    </button>
  )
}
