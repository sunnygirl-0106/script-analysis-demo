import { useStore } from '../store/useStore'
import { Dialog } from './Dialog'
import { costShotPrompts, fmtCost } from '../services/cost'
import ui from '../styles/ui.module.css'
import d from '../styles/dialog.module.css'
import s from './GoVisualDialog.module.css'

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
      <div className={d.title}>现在去生图？</div>
      <div className={d.desc}>
        还有 {n} 镜没有提示词。先生全再去资产库出图，角色和场景的一致性会更好。
      </div>
      <div className={d.footRow}>
        <span className={d.footNote}>剩余 {n} 镜约 {fmtCost(cost)} · {estMinutes(n)} 分钟</span>
        <span className={d.footBtns}>
          <button className={ui.btn} onClick={() => { setStage('visual'); onClose() }}>
            先去生图
          </button>
          <button
            className={[ui.btn, ui.btnPrimary].join(' ')}
            onClick={() => { generatePrompts(needIds); onClose() }}
          >
            生成全部提示词
          </button>
        </span>
      </div>
    </Dialog>
  )
}
