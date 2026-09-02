import { useStore } from '../store/useStore'
import { fmtCost } from '../services/cost'
import ui from '../styles/ui.module.css'
import d from './ScriptImportDialog.module.css'
import s from './UploadConfirmDialog.module.css'

// 第三拍：确认花费弹窗（改动方案 v2.3 §二）。预估跑完弹出，点确认后才真正开始解析。
// 字数 / 集场数 / 消耗都是演示口径（§6：随便定一个好看且能自圆其说的数），预估阶段本就是估。
const WORD_COUNT = '3.2 万字'
const EST_EPISODES = 12
const EST_SCENES = 48
const PARSE_COST = 100

export function UploadConfirmDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void
  onConfirm: () => void
}) {
  const title = useStore((st) => st.project.title)

  return (
    <div className={d.overlay} onClick={onCancel}>
      <div className={d.dialog} style={{ width: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className={d.title}>确认解析剧本</div>

        <div className={s.meta}>《{title}》· {WORD_COUNT}</div>
        <div className={s.metaSub}>预计拆出 {EST_EPISODES} 集 · {EST_SCENES} 场</div>

        <p className={s.ask}>
          是否确认拆解并提取该剧本中的所有角色、服装、场景、道具，并生成提示词？
        </p>

        <div className={s.cost}>本次消耗 {fmtCost(PARSE_COST)}</div>
        <div className={s.note}>本次只提取资产，暂不拆分镜头</div>

        <div className={d.actions}>
          <button className={ui.btn} onClick={onCancel}>取消</button>
          <button className={[ui.btn, ui.btnPrimary].join(' ')} onClick={onConfirm}>
            确认解析 · {fmtCost(PARSE_COST)}
          </button>
        </div>
      </div>
    </div>
  )
}
