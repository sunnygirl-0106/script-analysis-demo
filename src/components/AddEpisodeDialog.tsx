import { useState } from 'react'
import { useStore } from '../store/useStore'
import ui from '../styles/ui.module.css'
import s from './AddEpisodeDialog.module.css'

// ★ 追加集：演示新集资产去重（老角色复用旧 id，新角色入库），第 1 集内容原样不动。
export function AddEpisodeDialog({ disabled }: { disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const appendEpisode2 = useStore((st) => st.appendEpisode2)
  const hasEp2 = useStore((st) => st.project.episodes.some((e) => e.id === 'e2'))

  return (
    <>
      <button className={ui.btn} disabled={disabled || hasEp2} onClick={() => setOpen(true)}>
        {hasEp2 ? '已追加第 2 集' : '追加第 2 集'}
      </button>
      {open && (
        <div className={s.overlay} onClick={() => setOpen(false)}>
          <div className={s.dialog} onClick={(e) => e.stopPropagation()}>
            <div className={s.title}>追加「第 2 集 · 视频求生」</div>
            <div className={s.body}>
              这一集里既有老角色，又有新角色。追加后：
              <ul>
                <li>
                  老角色 <b>苏可</b> 按归一化名称命中，<b>复用原 id</b>，不新建。
                </li>
                <li>
                  新角色 <b>快递员</b> 入库，全剧资产<b>净增 1</b>。
                </li>
                <li>第 1 集的集 / 场 / 镜 / 挂载<b>一个字节都不动</b>。</li>
              </ul>
            </div>
            <div className={s.actions}>
              <button className={ui.btn} onClick={() => setOpen(false)}>
                取消
              </button>
              <button
                className={[ui.btn, ui.btnPrimary].join(' ')}
                onClick={() => {
                  appendEpisode2()
                  setOpen(false)
                }}
              >
                确认追加
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
