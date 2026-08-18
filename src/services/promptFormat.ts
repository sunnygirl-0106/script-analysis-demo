// 把 '【镜头规格】…\n【主体】…' 解析成分段结构，供提示词分段展示用。
// 视频提示词首部可能是无标签的时间码行，归入 tag 为空的段。

export interface PromptSection {
  tag: string
  body: string
}

export function parsePromptSections(text: string): PromptSection[] {
  const matches = [...text.matchAll(/【([^】]+)】/g)]
  if (matches.length === 0) return [{ tag: '', body: text.trim() }]

  const sections: PromptSection[] = []

  // 首个【前面的引导文本（如视频的时间码行）单独成段，tag 为空。
  const firstStart = matches[0]!.index ?? 0
  const lead = text.slice(0, firstStart).trim()
  if (lead) sections.push({ tag: '', body: lead })

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]!
    const tag = m[1]!
    const start = (m.index ?? 0) + m[0].length
    const end = i + 1 < matches.length ? (matches[i + 1]!.index ?? text.length) : text.length
    sections.push({ tag, body: text.slice(start, end).trim() })
  }
  return sections
}
