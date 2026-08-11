import { useState } from 'react'
import { parsePromptSections } from '../services/promptFormat'
import s from './PromptSections.module.css'

// 分段渲染一条提示词。
// flow=true：合并成一整段话（对齐参考稿画面列），【禁止】另起一行淡字；
// flow=false：逐段渲染，段标签灰字；【禁止】默认折叠。
export function PromptSections({
  text,
  flow,
  dropTags,
}: {
  text: string
  flow?: boolean
  dropTags?: string[]
}) {
  const [showForbid, setShowForbid] = useState(false)
  const sections = parsePromptSections(text)

  if (flow) {
    const forbid = sections.find((sec) => sec.tag === '禁止')
    const drop = new Set(['禁止', ...(dropTags ?? [])])
    const body = sections
      .filter((sec) => !drop.has(sec.tag))
      .map((sec) => sec.body)
      .join('')
    return (
      <div className={s.flowWrap}>
        <div className={s.flowBody}>{body}</div>
        {forbid && <div className={s.flowForbid}>禁止 · {forbid.body}</div>}
      </div>
    )
  }

  return (
    <div className={s.psWrap}>
      {sections.map((sec, i) => {
        if (sec.tag === '禁止') {
          return (
            <div className={s.psRow} key={i}>
              <button className={s.psForbid} onClick={() => setShowForbid((v) => !v)}>
                {showForbid ? '▾' : '▸'} 【禁止】
              </button>
              {showForbid && <div className={s.psBody}>{sec.body}</div>}
            </div>
          )
        }
        return (
          <div className={s.psRow} key={i}>
            {sec.tag && <span className={s.psTag}>【{sec.tag}】</span>}
            <span className={s.psBody}>{sec.body}</span>
          </div>
        )
      })}
    </div>
  )
}
