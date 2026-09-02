import { Fragment, useMemo } from 'react'
import { useStore } from '../store/useStore'
import { relatedAssetIds, splitMentions } from '../services/mentions'
import { KIND_DOT } from './entity'
import s from './EntityText.module.css'

/**
 * 文本里的实体词。一句话口径（v2.6 §5.2）：**@ 得进来的东西，看得出来是什么**。
 *
 * 两种用法都静态上类目色（KIND_DOT，与左侧「本场剧本」原文面板同一口径）+ 一条同色淡下划线；
 * 从前 link 变体的「静态零色、hover 才亮」那条决策已推翻——用户自己 @ 插进去的资产名，
 * 显示时就该看得出它是资产，而不是要 hover 一遍才知道哪几个词是实体。
 *
 * variant='link'（默认，「主要内容」用）—— 另外两条约束不变：
 *   1. **高亮只往「出场的人和物」去**，不往左边「本场剧本」去 —— 原文面板自己已经在标实体了，
 *      再叠一层联动高亮就是噪音。
 *   2. **单向**：hover 散文里的名字 → 点亮对应挂载项。反方向（hover chip → 点亮正文）
 *      故意没做，避免高亮在两个区域来回跳。
 *
 * variant='mark'（「查看提示词」用）—— 纯静态，不订阅 hover 联动：它垫在 textarea 底下当背板，
 * 只负责上色，不改字重 / 字距（背板要和上层透明 textarea 像素对齐）。
 */
export function EntityText({
  text,
  shotId,
  variant = 'link',
}: {
  text: string
  shotId?: string
  variant?: 'link' | 'mark'
}) {
  const assets = useStore((st) => st.project.assets)
  const parts = useMemo(() => splitMentions(text, assets), [text, assets])
  const colorOf = (assetId: string) => {
    const kind = assets[assetId]?.kind
    return kind ? KIND_DOT[kind] : undefined
  }
  return (
    <>
      {parts.map((p, i) =>
        p.assetId ? (
          variant === 'mark' ? (
            <span key={i} className={s.markColor} style={{ color: colorOf(p.assetId) }}>
              {p.text}
            </span>
          ) : (
            <Mention
              key={i}
              assetId={p.assetId}
              shotId={shotId ?? ''}
              text={p.text}
              color={colorOf(p.assetId)}
            />
          )
        ) : (
          <Fragment key={i}>{p.text}</Fragment>
        ),
      )}
    </>
  )
}

function Mention({
  assetId, shotId, text, color,
}: { assetId: string; shotId: string; text: string; color?: string }) {
  const setHover = useStore((st) => st.setHoverMention)
  return (
    <span
      className={s.ment}
      style={{ color }}
      onMouseEnter={() => setHover({ assetId, shotId })}
      onMouseLeave={() => setHover(null)}
    >
      {text}
    </span>
  )
}

/**
 * 「我该不该亮」——供「出场的人和物」里的 chip / 角色卡订阅。
 * 同镜（shotId 相同）才亮：hover 镜 3 的「苏可」只点亮镜 3 的角色卡，
 * 不去点亮镜 1、2、4…… 那种全场齐亮是噪音，不是联动。
 * selector 返回 boolean，所以只在这一项的亮/暗真正翻转时才重渲染，hover 一次不会刷整张表。
 */
export function useEntityLit(assetId: string, shotId: string): boolean {
  return useStore((st) => {
    const h = st.hoverMention
    if (!h || h.shotId !== shotId) return false
    return relatedAssetIds(h.assetId, st.project.assets).has(assetId)
  })
}
