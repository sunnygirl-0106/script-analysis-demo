import { parsePromptSections } from '../services/promptFormat'
import s from './PromptSections.module.css'

// 完整分段渲染一条提示词：内容全部展示，不过滤、不裁切、不折叠。
// - 段标签（【主体】【表演】【台词】…）稍浅稍加粗，正文自然换行；
// - 视频提示词开头的时间码段（无标签）作为轻量时间码文本，保留换行；
// - 【禁止】用较淡文字完整显示，不折叠不隐藏。
export function PromptSections({ text }: { text: string }) {
  const sections = parsePromptSections(text)

  return (
    <div className={s.full}>
      {sections.map((sec, i) => {
        if (!sec.tag) {
          // 引导段：视频提示词的时间码行，保留换行的轻量文本。
          return (
            <div className={s.tc} key={i}>
              {sec.body}
            </div>
          )
        }
        const forbid = sec.tag === '禁止'
        return (
          <p className={[s.seg, forbid ? s.segForbid : ''].join(' ')} key={i}>
            <span className={s.segTag}>【{sec.tag}】</span>
            <span className={s.segBody}>{sec.body}</span>
          </p>
        )
      })}
    </div>
  )
}
