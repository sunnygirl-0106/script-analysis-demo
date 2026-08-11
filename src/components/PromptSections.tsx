import { useState } from 'react'
import { parsePromptSections } from '../services/promptFormat'
import s from './ShotDetail.module.css'

// 分段渲染一条提示词：段标签灰字、正文次级色；【禁止】段最长最不常看，默认折叠。
export function PromptSections({ text }: { text: string }) {
  const [showForbid, setShowForbid] = useState(false)
  const sections = parsePromptSections(text)

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
