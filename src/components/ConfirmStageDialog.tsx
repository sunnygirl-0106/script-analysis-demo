import { useMemo } from 'react'
import { useStore } from '../store/useStore'
import { mountIssues } from '../services/completeness'
import { sceneDuration } from '../services/timeline'
import ui from '../styles/ui.module.css'
import d from './ScriptImportDialog.module.css'
import s from './ConfirmStageDialog.module.css'

// ★ 「进入视觉筹备」前置确认：把当前拆解结果摊开给用户看一眼，重量由弹窗承担，按钮保持轻。
export function ConfirmStageDialog({ onClose }: { onClose: () => void }) {
  const project = useStore((st) => st.project)
  const setStage = useStore((st) => st.setStage)

  const stat = useMemo(() => {
    const scenes = Object.values(project.scenes)
    const shot = scenes.reduce((n, sc) => n + sc.shotIds.length, 0)
    const dur = scenes.reduce((n, sc) => n + sceneDuration(sc, project.shots), 0)
    const assets = Object.values(project.assets)
    // 有「未挂载」动作提示（规则 1）的镜数。
    const flagged = Object.values(project.shots).filter((sh) =>
      mountIssues(sh, project.assets).some((iss) => iss.level === 'action'),
    ).length
    return {
      ep: project.episodes.length,
      scene: scenes.length,
      shot,
      dur,
      character: assets.filter((a) => a.kind === 'character').length,
      costume: assets.filter((a) => a.kind === 'costume').length,
      location: assets.filter((a) => a.kind === 'location').length,
      prop: assets.filter((a) => a.kind === 'prop').length,
      flagged,
    }
  }, [project])

  const confirm = () => {
    setStage('visual')
    onClose()
  }

  return (
    <div className={d.overlay} onClick={onClose}>
      <div className={d.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={d.title}>确认剧本拆解结果</div>

        <div className={s.lead}>当前剧本已拆解为：</div>
        <div className={s.stat}>
          {stat.ep} 集 · {stat.scene} 场 · {stat.shot} 镜 · 约 {stat.dur} 秒
        </div>
        <div className={s.stat}>
          {stat.character} 个角色 · {stat.costume} 套服装 · {stat.location} 个场景 · {stat.prop} 个道具
        </div>

        {stat.flagged > 0 && (
          <div className={s.warn}>
            ⚠ {stat.flagged} 个镜头存在未挂载的资产提示，建议确认后再进入。
          </div>
        )}

        <div className={s.desc}>
          确认后将以当前剧本拆解结果进入视觉筹备。剧本分析将切换为只读；如果之后返回修改，受影响的后续生成结果可能需要重新生成。
        </div>

        <div className={d.actions}>
          <button className={ui.btn} onClick={onClose}>
            继续检查
          </button>
          <button className={[ui.btn, ui.btnPrimary].join(' ')} onClick={confirm}>
            确认并进入
          </button>
        </div>
      </div>
    </div>
  )
}
