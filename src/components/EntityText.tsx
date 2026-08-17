import { Fragment, useMemo } from 'react'
import { useStore } from '../store/useStore'
import { relatedAssetIds, splitMentions } from '../services/mentions'
import { KIND_COLOR } from './entity'
import s from './EntityText.module.css'

/**
 * 文本里的实体词。两种用法由 variant 决定：
 *
 * variant='link'（默认，「主要内容」用）—— 三条刻意的约束：
 *   1. **静态零色**。分镜表是灰阶区，颜色留给状态（琥珀＝待更新）；实体身份由旁边
 *      「出场的人和物」那一列承担。在散文里再按类目上一遍色，一格就又紫又绿又黄了。
 *   2. **高亮只往「出场的人和物」去**，不往左边「本场剧本」去 —— 原文面板是彩色区，
 *      它自己已经在标实体了，再叠一层联动高亮就是噪音。
 *   3. **单向**：hover 散文里的名字 → 点亮对应挂载项。反方向（hover chip → 点亮正文）
 *      故意没做，避免高亮在两个区域来回跳。
 *
 * variant='mark'（「查看提示词」用）—— 纯静态、按类目上色：角色紫 / 场景绿 / 道具黄 / 服装粉，
 *   与「出场的人和物」的配色对应上。不订阅 store、不接 hover 联动（弹窗是模态层，点亮背后 chip 无意义），
 *   只是让读者一眼认出「哪些词是角色/场景/道具，各属哪一类」。
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
  return (
    <>
      {parts.map((p, i) =>
        p.assetId ? (
          variant === 'mark' ? (
            <span
              key={i}
              className={s.markColor}
              style={{ color: KIND_COLOR[assets[p.assetId]?.kind ?? 'character'] }}
            >
              {p.text}
            </span>
          ) : (
            <Mention key={i} assetId={p.assetId} shotId={shotId ?? ''} text={p.text} />
          )
        ) : (
          <Fragment key={i}>{p.text}</Fragment>
        ),
      )}
    </>
  )
}

function Mention({ assetId, shotId, text }: { assetId: string; shotId: string; text: string }) {
  const setHover = useStore((st) => st.setHoverMention)
  return (
    <span
      className={s.ment}
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
