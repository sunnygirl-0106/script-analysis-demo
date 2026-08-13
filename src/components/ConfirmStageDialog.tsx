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
    const UNIT: Record<string, string> = { character: '个', costume: '套', location: '个', prop: '件' }
    const exclByKind = FIRST_BATCH_KINDS
      .map((k) => ({ k, n: excluded.filter((a) => a.kind === k).length }))
      .filter((x) => x.n > 0)
      .map((x) => `${x.n} ${UNIT[x.k] ?? '项'}${KIND_LABEL[x.k]}`)
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
        <div className={d.title}>即将生成第一批资产</div>

        <div className={s.lead}>第一批将生成 <b>{bill.total}</b> 项基础资产</div>
        <div className={s.stat}>
          {bill.character} 个角色形象 · {bill.costume} 套服装 · {bill.location} 个场景 · {bill.prop} 件道具
        </div>
        {bill.excludedText && <div className={s.desc}>已跳过 {bill.excludedText}</div>}

        {bill.lookCount > 0 && (
          <div className={s.warn}>
            另有 {bill.lookCount} 套角色造型将在下一步生成
            <div className={s.subWarn}>确认角色形象和服装后，即可生成对应的角色造型</div>
          </div>
        )}

        <div className={s.desc}>
          进入项目资产库后仍可调整剧本和提示词，但不能直接修改角色与服装的组合。
        </div>

        <div className={d.actions}>
          <button className={ui.btn} onClick={onClose}>返回修改</button>
          <button className={[ui.btn, ui.btnPrimary].join(' ')} onClick={confirm}>开始生成第一批</button>
        </div>
      </div>
    </div>
  )
}
