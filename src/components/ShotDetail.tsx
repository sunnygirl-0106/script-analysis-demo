import { useStore } from '../store/useStore'
import type { Shot } from '../data/types'
import { PromptSections } from './PromptSections'
import d from './ShotDetail.module.css'

// 展开的镜头详情：跨满分镜表全宽的一整行。
// 表格里的提示词列只有约 340px（每行 25 个汉字），完全版单条 600 字要 24 行；
// 铺到全宽两栏（各约 530px）只要 13 行，所以全文放这里，表格里只留摘要。
export function ShotDetail({ shot }: { shot: Shot }) {
  const showToast = useStore((st) => st.showToast)

  const copy = (label: string, text: string) => async () => {
    try {
      await navigator.clipboard.writeText(text)
      showToast(`已复制${label}（${text.length} 字）`)
    } catch {
      showToast('浏览器拒绝了剪贴板访问，请手动选择文本复制')
    }
  }

  // 删掉「镜头」列之后，这六个字段在界面上的唯一出口。
  const params: [string, string][] = [
    ['景别', shot.shotSize],
    ['焦段', shot.lens],
    ['光影', shot.lighting],
    ['运镜', shot.cameraMove],
    ['对白', shot.dialogue],
    ['音效', shot.sfx],
  ]

  const boxes: [string, string][] = [
    ['画面提示词', shot.imagePrompt],
    ['视频提示词', shot.videoPrompt],
  ]

  return (
    <div className={d.wrap}>
      <div className={d.params}>
        {params.map(([k, v]) => (
          <span className={d.param} key={k}>
            <i>{k}</i>
            {v || '—'}
          </span>
        ))}
      </div>

      <div className={d.cols}>
        {boxes.map(([label, text]) => (
          <section className={d.box} key={label}>
            <header className={d.h}>
              <b>{label}</b>
              <em>{text.length} 字</em>
              <button className={d.copy} onClick={copy(label, text)} title="复制整段，直接喂给模型">
                复制
              </button>
            </header>
            <div className={d.body}>
              <PromptSections text={text} />
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
