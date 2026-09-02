import { useState } from 'react'
import { STEPS } from '../components/StepBar'
import { ScriptIllustration } from '../components/ScriptIllustration'
import { ScriptSourceDialog } from '../components/ScriptSourceDialog'
import s from './EmptyScriptState.module.css'

// 空态（源自 空剧本.html 的 2a）：进站第一屏。
// 点「＋ 上传剧本」先弹一个真实的选文件弹窗（上传文件 / 粘贴文本），
// 点「开始整理」才关窗跑整页动效——上传必须是一个真的动作，不能一点就自己开始。
// 没有确认花费弹窗：上传 / 研读 / 拆集免费，整理剧本页本身就是预估结果页。
export function EmptyScriptState() {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <div className={s.wrap}>
      <div className={s.hero}>
        <div className={s.glow} />
        <div className={s.dots} />

        <div className={s.illo}>
          <ScriptIllustration />
        </div>

        <div className={s.title}>这个项目还没有剧本</div>
        <div className={s.sub}>
          上传剧本后，自动整理成集并校对，随后提取角色、服装、场景、道具四类资产。
        </div>

        <button className={s.cta} onClick={() => setDialogOpen(true)}>
          <span className={s.ctaPlus}>＋</span>上传剧本
        </button>
        <div className={s.hint}>支持 txt / docx / fdx</div>

        <div className={s.steps}>
          <span className={s.stepLine} />
          <div className={s.stepRow}>
            {STEPS.map((step, i) => (
              <div className={s.step} key={step.n}>
                <span className={[s.stepDot, i === 0 ? s.stepDotOn : ''].join(' ')}>{step.n}</span>
                <span className={[s.stepTitle, i === 0 ? s.stepTitleOn : ''].join(' ')}>{step.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {dialogOpen && <ScriptSourceDialog mode="first" onClose={() => setDialogOpen(false)} />}
    </div>
  )
}
