import { useStore } from '../store/useStore'
import { altScriptPayload } from '../data/seedAltScript'
import ui from '../styles/ui.module.css'
import d from './ScriptImportDialog.module.css'

// 阶段② 的「重新上传剧本」确认弹窗（§4.1）。仅未入库时可达——store.reuploadScript 已实现，这里只接线。
// 换一份原文整本替换：库仍为空、零副作用；一旦入过库这个入口就没有了。
export function ReuploadDialog({ count, onClose }: { count: number; onClose: () => void }) {
  const reuploadScript = useStore((st) => st.reuploadScript)

  const confirm = () => {
    reuploadScript(altScriptPayload)
    onClose()
  }

  return (
    <div className={d.overlay} onClick={onClose}>
      <div className={d.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={d.title}>重新上传剧本</div>

        <div className={d.optDesc} style={{ marginTop: 0, marginBottom: 14 }}>
          当前这 {count} 项一条都还没写进项目资产库，分镜也还没生成，所以整本替换是零副作用的。
          换上新剧本后，会重新抽取资产清单再让你确认。
        </div>

        <div className={d.danger}>
          <b>一旦点过「确认并保存到项目资产库」，这个入口就没有了</b>
          —— 那之后要换一部剧本，请新建项目。
        </div>

        <div className={d.actions}>
          <button className={ui.btn} onClick={onClose}>取消</button>
          <button className={[ui.btn, ui.btnPrimary].join(' ')} onClick={confirm}>
            换上新剧本重新拆解
          </button>
        </div>
      </div>
    </div>
  )
}
