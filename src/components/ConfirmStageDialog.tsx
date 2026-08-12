import { useMemo } from 'react'
import { useStore } from '../store/useStore'
import { FIRST_BATCH_KINDS } from '../data/types'
import { KIND_LABEL } from './entity'
import ui from '../styles/ui.module.css'
import d from './ScriptImportDialog.module.css'
import s from './ConfirmStageDialog.module.css'

// ★ 「进入资产生产」前置确认 = 出图账单（决策 5a / 6.7）。
// 只报第一批的数 + 「着装角色不在本批」一句，不列具体的着装组合明细。
export function ConfirmStageDialog({ onClose }: { onClose: () => void }) {
  const project = useStore((st) => st.project)
  const setStage = useStore((st) => st.setStage)

  const bill = useMemo(() => {
    const firstKinds = new Set<string>(FIRST_BATCH_KINDS)
    const assets = Object.values(project.assets)
    const base = assets.filter((a) => firstKinds.has(a.kind))
    const inBatch = base.filter((a) => !a.excluded)
    const excluded = base.filter((a) => a.excluded)
    const countIn = (k: string) => inBatch.filter((a) => a.kind === k).length
    // 已排除按类目汇总，如「1 项道具」。
    const exclByKind = FIRST_BATCH_KINDS
      .map((k) => ({ k, n: excluded.filter((a) => a.kind === k).length }))
      .filter((x) => x.n > 0)
      .map((x) => `${x.n} 项${KIND_LABEL[x.k]}`)
    return {
      total: inBatch.length,
      character: countIn('character'),
      costume: countIn('costume'),
      location: countIn('location'),
      prop: countIn('prop'),
      excludedText: exclByKind.join(' · '),
      lookCount: assets.filter((a) => a.kind === 'look').length,
    }
  }, [project])

  const confirm = () => {
    // 进入 = setStage('visual')（同时给第一批资产写 deliveredRevision = promptRevision，决策 6.7）。
    setStage('visual')
    onClose()
  }

  return (
    <div className={d.overlay} onClick={onClose}>
      <div className={d.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={d.title}>即将进入资产生产</div>

        <div className={s.lead}>本批将生成 <b>{bill.total}</b> 项</div>
        <div className={s.stat}>
          角色素模 {bill.character} · 服装 {bill.costume} · 场景 {bill.location} · 道具 {bill.prop}
        </div>
        {bill.excludedText && <div className={s.desc}>（已排除 {bill.excludedText}）</div>}

        {bill.lookCount > 0 && (
          <div className={s.warn}>
            着装角色 {bill.lookCount} 项不在本批
            <div className={s.subWarn}>需素模与服装出图并确认后再生成</div>
          </div>
        )}

        <div className={s.desc}>
          进入后仍可修改提示词与剧本。
          <br />
          角色与服装的绑定关系不可更改。
        </div>

        <div className={d.actions}>
          <button className={ui.btn} onClick={onClose}>返回检查</button>
          <button className={[ui.btn, ui.btnPrimary].join(' ')} onClick={confirm}>开始生成</button>
        </div>
      </div>
    </div>
  )
}
