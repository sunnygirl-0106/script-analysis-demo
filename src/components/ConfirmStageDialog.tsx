import { useMemo } from 'react'
import { useStore } from '../store/useStore'
import { mountIssues } from '../services/completeness'
import { firstBatchAssets } from '../services/production'
import ui from '../styles/ui.module.css'
import d from './ScriptImportDialog.module.css'
import s from './ConfirmStageDialog.module.css'

// ★ 第一批资产生产确认页：只统计四类基础资产，不统计着装角色。
// 确认即调用 startAssetProduction() 生成生产快照并进入视觉筹备。
export function ConfirmStageDialog({ onClose }: { onClose: () => void }) {
  const project = useStore((st) => st.project)
  const startAssetProduction = useStore((st) => st.startAssetProduction)

  const stat = useMemo(() => {
    const base = firstBatchAssets(project)
    const by = (k: string) => base.filter((a) => a.kind === k).length
    // 缺着装角色 / 场景 / 道具等提示（含 action 与 hint）的镜数。
    const flagged = Object.values(project.shots).filter(
      (sh) => mountIssues(sh, project.assets).length > 0,
    ).length
    return {
      character: by('character'),
      costume: by('costume'),
      location: by('location'),
      prop: by('prop'),
      total: base.length,
      flagged,
    }
  }, [project])

  const confirm = () => {
    startAssetProduction()
    onClose()
  }

  return (
    <div className={d.overlay} onClick={onClose}>
      <div className={d.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={d.title}>即将开始资产生产</div>

        <div className={s.lead}>第一批将生成：</div>
        <div className={s.stat}>
          {stat.character} 个素模角色 · {stat.costume} 套服装 · {stat.location} 个场景 · {stat.prop} 个道具
        </div>
        <div className={s.stat}>共 {stat.total} 项基础资产</div>

        <div className={s.desc}>着装角色将在基础资产确认后另行生成，本次不包含。</div>

        {stat.flagged > 0 && (
          <div className={s.warn}>
            ⚠ {stat.flagged} 个镜头存在缺少着装角色 / 场景 / 道具的提示，建议确认后再进入。
          </div>
        )}

        <div className={d.actions}>
          <button className={ui.btn} onClick={onClose}>
            继续检查
          </button>
          <button className={[ui.btn, ui.btnPrimary].join(' ')} onClick={confirm}>
            确认并开始生产
          </button>
        </div>
      </div>
    </div>
  )
}
