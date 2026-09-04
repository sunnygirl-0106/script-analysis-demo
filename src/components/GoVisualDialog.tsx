import { useStore } from '../store/useStore'
import { Dialog } from './Dialog'
import { costShotPrompts, fmtCost } from '../services/cost'
import ui from '../styles/ui.module.css'
import s from './GoVisualDialog.module.css'
import { ic } from './icons'

// 「现在去生图？」软提醒（v2.6 §6.2）。
//
// 语气是建议，不是拦截：两个按钮都能走，没有 × —— 这两个出口就是全部出口。
// 它只在「还有镜头没生成提示词」时出现；全剧就绪时页脚那个主按钮直接进资产库，不弹。
//
// 与 ConfirmPromptDialog 的分工：那个是范围勾选（选哪些镜生成），这个不做任何选择，
// 只在「先去生图」和「把提示词生全」之间给一句理由。

/** 演示口径：一镜提示词约 5 秒，向上取整到分钟。 */
const estMinutes = (n: number) => Math.max(1, Math.round((n * 5) / 60))

export function GoVisualDialog({
  needIds,
  onClose,
}: {
  needIds: string[]
  onClose: () => void
}) {
  const generatePrompts = useStore((st) => st.generatePrompts)
  const setStage = useStore((st) => st.setStage)
  const n = needIds.length
  const cost = costShotPrompts(needIds)

  return (
    <Dialog
      onClose={onClose}
      className={s.dialog}
    >
      <div className={s.title}>现在去生图？</div>
      <div className={s.body}>
        还有 {n} 个镜头没有生成提示词。先把提示词生全，再去资产库生图、生视频，
        角色和场景的一致性会更好，也省得回头补。
      </div>
      <div className={s.est}>
        {ic.spark} 生成剩余 {n} 镜提示词约 {fmtCost(cost)} · 约 {estMinutes(n)} 分钟
      </div>
      <div className={s.actions}>
        <button className={ui.btn} onClick={() => { setStage('visual'); onClose() }}>
          先去生图
        </button>
        <button
          className={[ui.btn, ui.btnPrimary].join(' ')}
          onClick={() => { generatePrompts(needIds); onClose() }}
        >
          生成全部提示词 · {fmtCost(cost)}
        </button>
      </div>
    </Dialog>
  )
}
