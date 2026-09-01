import { useStore } from '../store/useStore'
import type { CandidateDecision } from '../data/types'
import { KIND_DOT, KIND_LABEL } from './entity'
import di from './ScriptImportDialog.module.css'
import cp from './ConfirmPromptDialog.module.css'
import ui from '../styles/ui.module.css'
import s from './IncrementalGateDialog.module.css'

// 后续增量的轻量确认（v3 §4.2）。与阶段② 完整确认页是两个不同重量的界面。
// 只在有挂起任务（pendingTask != null）且有候选时出现。
const DECISIONS: { key: CandidateDecision; label: string }[] = [
  { key: 'new', label: '作为新资产' },
  { key: 'link', label: '关联已有' },
  { key: 'skip', label: '忽略' },
]

export function IncrementalGateDialog() {
  const candidates = useStore((st) => st.candidates)
  const task = useStore((st) => st.pendingTask)
  const assets = useStore((st) => st.project.assets)
  const setDecision = useStore((st) => st.setCandidateDecision)
  const renameCandidate = useStore((st) => st.renameCandidate)
  const commit = useStore((st) => st.commitCandidates)
  const cancel = useStore((st) => st.cancelIncrementalGate)

  if (!task || candidates.length === 0) return null

  const committedCount = Object.keys(assets).length

  const consequence = (d: CandidateDecision): string =>
    d === 'new' ? '将作为一条全新资产入库（提示词从 0 版开始）。'
      : d === 'link' ? '不新建，仅把本次识别关联到已选的既有资产。'
        : '本次忽略，不入库、不关联。'

  return (
    <div className={di.overlay} onClick={cancel}>
      <div className={[cp.dialog, s.dialog].join(' ')} onClick={(e) => e.stopPropagation()}>
        <div className={cp.head}>
          <span className={cp.headLeft}>
            <i className={cp.bar} />
            <span className={cp.title}>新识别到 {candidates.length} 项资产</span>
          </span>
          <span className={cp.headRight}>
            <span className={cp.headMeta}>{task.label} · 范围 {task.scopeText}</span>
          </span>
        </div>

        <div className={s.warn}>
          本次只处理增量。已入库的 {committedCount} 项及其图片不会被覆盖，也不会被删除。处理完会自动继续刚才的任务。
        </div>

        <div className={s.list}>
          {candidates.map((c) => {
            const sameKind = Object.values(assets).filter((a) => a.kind === c.kind)
            return (
              <div key={c.tempId} className={s.row}>
                <div className={s.rowMain}>
                  <i className={s.dot} style={{ background: KIND_DOT[c.kind] }} />
                  <input
                    className={s.nameInput}
                    value={c.name}
                    disabled={c.decision !== 'new'}
                    onChange={(e) => renameCandidate(c.tempId, e.target.value)}
                  />
                  <span className={s.kindTag}>{KIND_LABEL[c.kind]}</span>
                  <span className={s.src}>
                    来源 全剧 {c.occCount ?? 0} 处{c.firstParaNo ? ` · 首现第 ${c.firstParaNo} 段` : ''}
                  </span>
                </div>

                <div className={s.rowCtrl}>
                  <div className={cp.scopeSeg}>
                    {DECISIONS.map((d) => (
                      <button
                        key={d.key}
                        className={[cp.segBtn, c.decision === d.key ? cp.segOn : ''].join(' ')}
                        onClick={() => setDecision(c.tempId, d.key, d.key === 'link' ? (c.linkTargetId ?? sameKind[0]?.id) : undefined)}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>

                  {c.decision === 'link' && (
                    <select
                      className={s.linkSel}
                      value={c.linkTargetId ?? sameKind[0]?.id ?? ''}
                      onChange={(e) => setDecision(c.tempId, 'link', e.target.value)}
                    >
                      {sameKind.length === 0 && <option value="">（无同类已入库资产）</option>}
                      {sameKind.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className={s.hint}>{consequence(c.decision)}</div>
              </div>
            )
          })}
        </div>

        <div className={cp.foot}>
          <button className={ui.btn} onClick={cancel}>取消整次操作</button>
          <span className={s.footSpacer} />
          <button className={cp.cta} onClick={commit}>确认并继续 →</button>
        </div>
      </div>
    </div>
  )
}
