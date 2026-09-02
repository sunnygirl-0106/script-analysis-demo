import { useState } from 'react'
import { Dialog } from '../components/Dialog'
import { useStore } from '../store/useStore'
import { FIRST_BATCH_KINDS, type Asset } from '../data/types'
import { KIND_LABEL } from '../components/entity'
import { syncState } from '../services/staleness'
import ui from '../styles/ui.module.css'
import di from '../styles/dialog.module.css'
import s from './VisualPrep.module.css'

// 阶段② 简版：队列 = 第一批四类基础资产 ∩ 未排除（决策 2b）。着装角色不进第一批，不在此出现。
// v2.0：资产库是 v3 唯一的删除出口 —— 这里给每张资产卡加删除入口（二次确认）。
export function VisualPrep() {
  const assets = useStore((st) => st.project.assets)
  const deleteAsset = useStore((st) => st.deleteAsset)
  const countShotsOf = useStore((st) => st.countShotsOf)
  // 待删确认：null = 关闭。
  const [confirm, setConfirm] = useState<Asset | null>(null)

  const grouped = (kind: string): Asset[] =>
    Object.values(assets).filter((a) => a.kind === kind && !a.excluded)

  const total = FIRST_BATCH_KINDS.reduce((n, k) => n + grouped(k).length, 0)

  // §11：已进入出图队列 / 已出图（syncState 非 draft）的资产，删除要更重的告警。
  const notDraft = confirm ? syncState(confirm) !== 'draft' : false
  const refShots = confirm ? countShotsOf(confirm.id) : 0

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div className={s.h1}>项目资产库</div>
        <div className={s.sub}>
          正在生成第一批：角色形象、服装、场景和道具。确认角色与服装后，再生成对应的角色造型。
        </div>
        <div className={s.stat}>
          <span>
            第一批共 <b>{total}</b> 项
          </span>
        </div>
      </div>

      <div className={s.scroll}>
        {FIRST_BATCH_KINDS.map((kind) => {
          const list = grouped(kind)
          if (list.length === 0) return null
          return (
            <div className={s.section} key={kind}>
              <div className={s.stitle}>
                <b>{KIND_LABEL[kind]}</b>
                <span>{list.length} 项</span>
              </div>
              <div className={s.grid}>
                {list.map((a) => (
                  <div key={a.id} className={s.item}>
                    <div className={s.itemHead}>
                      <span className={s.nm}>{a.name}</span>
                      <span className={[s.badge, s.badgeQueued].join(' ')}>生成中</span>
                      <button
                        className={s.delBtn}
                        title="从项目资产库删除"
                        onClick={() => setConfirm(a)}
                      >
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={1.7}>
                          <path d="M5 7h14M10 7V5h4v2M6 7l1 12h10l1-12" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                    <div className={s.thumb}>
                      <span className={s.slot} />
                    </div>
                    <div className={s.desc}>{a.imagePrompt}</div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {confirm && (
        <Dialog onClose={() => setConfirm(null)} className={di.dialog}>
          <div className={di.title}>从项目资产库删除「{confirm.name}」？</div>
          <div className={di.danger}>
            {notDraft
              ? '该资产已进入出图队列 / 已出图，删除不退还星钻。'
              : '删除后不可恢复。'}
            {refShots > 0 && `当前剧本有 ${refShots} 个镜头引用它，删除后这些镜头的挂载会失效并标记待更新（镜头文字保留，不会被清理）。`}
          </div>
          <div className={di.actions}>
            <button className={ui.btn} onClick={() => setConfirm(null)}>取消</button>
            <button
              className={[ui.btn, ui.btnDanger].join(' ')}
              onClick={() => { deleteAsset(confirm.id); setConfirm(null) }}
            >
              {notDraft ? '仍然删除' : '删除'}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  )
}
