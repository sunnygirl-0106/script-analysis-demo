import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import { scanRenameImpact, type RenameHit } from '../services/mentions'
import { KIND_LABEL } from './entity'
import ui from '../styles/ui.module.css'
import d from './ScriptImportDialog.module.css'
import s from './RenameAssetDialog.module.css'

/**
 * 改名确认弹窗。资产表里就地改完名字、回车 / 失焦之后弹出来。
 *
 * 大标题固定是「确认更改」——「重命名角色」是句废话：用户刚从那一行点进来，
 * 旧名 → 新名也摆在眼前。标题落在「确认更改」之后，这个弹窗的语气就从
 * 「你在做一次改名」变成了「你要不要顺带把下面这些也改掉」——后者才是它真正的问题。
 *（不用「同步替换」当标题：只重命名不勾替换的路径也存在，那时叫「同步替换」就名不副实。）
 * 类目词（角色 / 场景 / 道具 / 服装）下沉到副文案与勾选项说明里，跟着资产类型走。
 *
 * 只给两个勾，不给四个：用户不会想「主要内容换、对白不换」，拆细是假控制权。
 * 提示词单独一个勾，因为它的后果不同（涉及手改内容、涉及待更新状态、涉及积分）。
 */
export function RenameAssetDialog({
  assetId,
  nextName,
  onClose,
}: {
  assetId: string
  nextName: string
  onClose: () => void
}) {
  const project = useStore((st) => st.project)
  const promptStates = useStore((st) => st.promptStates)
  const rename = useStore((st) => st.renameAssetWithSync)

  const [prose, setProse] = useState(true)
  const [prompts, setPrompts] = useState(true)
  const [openDiff, setOpenDiff] = useState<'prose' | 'prompts' | null>(null)

  const asset = project.assets[assetId]
  const impact = useMemo(
    () => scanRenameImpact(project, promptStates, assetId, nextName),
    [project, promptStates, assetId, nextName],
  )
  if (!asset) return null

  const kind = KIND_LABEL[asset.kind]
  const promptHits = [...impact.shotPrompts, ...impact.assetPrompts]
  const proseCount = impact.prose.length
  const shotPromptCount = impact.shotPrompts.length
  const assetPromptCount = impact.assetPrompts.length

  // 两处都没命中 = 空态：收起勾选项，只留「自动更新」+ 一个确认。
  // 不因此改成「不弹窗」——改道具名不弹、改角色名弹，规律太难猜。
  const nothingToReplace = proseCount === 0 && promptHits.length === 0

  const confirm = () => {
    rename(assetId, nextName, { prose, prompts })
    onClose()
  }

  return (
    <div className={d.overlay} onClick={onClose}>
      <div className={s.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={s.head}>
          <div className={s.title}>确认更改</div>
          <div className={s.desc}>同一个{kind}在后续环节会继续使用新的名称。</div>
        </div>

        <div className={s.io}>
          <span className={s.oldName}>{asset.name}</span>
          <span className={s.arrow}>→</span>
          <span className={s.newName}>{nextName}</span>
        </div>

        <div className={s.sect}>
          <div className={s.sectTitle}>自动更新</div>
          <div className={s.auto}>
            <span className={s.ok}>✓</span>
            {impact.autoBits.join('　·　')}
          </div>
        </div>

        {!nothingToReplace && (
          <div className={s.sect}>
            <div className={s.sectTitle}>同步替换文本</div>

            <Opt
              on={prose}
              onToggle={() => setProse((v) => !v)}
              label="主要内容 · 对白 · 光影 · 音效"
              count={proseCount ? `共 ${proseCount} 处` : '无'}
              disabled={proseCount === 0}
              note={impact.proseByLabel.map((x) => `${x.label} ${x.count}`).join(' · ')}
              hits={impact.prose}
              diffOpen={openDiff === 'prose'}
              onDiff={() => setOpenDiff(openDiff === 'prose' ? null : 'prose')}
            />

            <Opt
              on={prompts}
              onToggle={() => setPrompts((v) => !v)}
              label="已生成的最终提示词"
              count={
                promptHits.length === 0
                  ? '无'
                  : [shotPromptCount ? `${shotPromptCount} 镜` : '', assetPromptCount ? `${assetPromptCount} 个资产` : '']
                      .filter(Boolean)
                      .join(' · ')
              }
              disabled={promptHits.length === 0}
              note={`只替换明确关联到该${kind}的名称，不重新生成，不消耗积分。`}
              hits={promptHits}
              diffOpen={openDiff === 'prompts'}
              onDiff={() => setOpenDiff(openDiff === 'prompts' ? null : 'prompts')}
            />

            {/* 不勾才是真的不一致 —— 把后果说清楚，不用恐吓语气 */}
            {(!prompts && shotPromptCount > 0) || (!prose && proseCount > 0) ? (
              <div className={s.warn}>
                <span className={s.warnIc}>⚠</span>
                <span>
                  {!prompts && shotPromptCount > 0 && (
                    <>
                      {shotPromptCount} 镜的提示词会继续写着「{asset.name}」，指不到任何资产，
                      这些镜头将标为<b>待更新</b>，需重新生成（消耗积分）。
                    </>
                  )}
                  {!prompts && shotPromptCount > 0 && !prose && proseCount > 0 && <br />}
                  {!prose && proseCount > 0 && (
                    <>
                      {proseCount} 处正文会继续写着「{asset.name}」，与「出场的人和物」显示的名字不一致。
                    </>
                  )}
                </span>
              </div>
            ) : null}
          </div>
        )}

        <div className={s.foot}>
          <span className={s.footHint}>改名后可在提示中撤销</span>
          <button className={ui.btn} onClick={onClose}>
            取消
          </button>
          <button className={[ui.btn, ui.btnPrimary].join(' ')} onClick={confirm}>
            {nothingToReplace || (!prose && !prompts) ? '仅重命名' : '重命名并替换'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Opt({
  on,
  onToggle,
  label,
  count,
  note,
  hits,
  disabled,
  diffOpen,
  onDiff,
}: {
  on: boolean
  onToggle: () => void
  label: string
  count: string
  note: string
  hits: RenameHit[]
  disabled: boolean
  diffOpen: boolean
  onDiff: () => void
}) {
  return (
    <div className={[s.opt, disabled ? s.optOff : ''].join(' ')}>
      <label className={s.optMain}>
        <input type="checkbox" className={s.check} checked={on && !disabled} disabled={disabled} onChange={onToggle} />
        <span className={s.optLabel}>{label}</span>
        <span className={s.optCount}>{count}</span>
      </label>
      {hits.length > 0 && (
        <button className={s.see} onClick={onDiff}>
          {diffOpen ? '收起' : '查看'}
        </button>
      )}
      {note && <div className={s.optNote}>{note}</div>}
      {diffOpen && (
        <div className={s.diff}>
          {hits.map((h, i) => (
            <div className={s.diffRow} key={i}>
              <span className={s.diffWhere}>{h.where}</span>
              <span className={s.diffBefore}>{h.before}</span>
              <span className={s.diffArrow}>→</span>
              <span className={s.diffAfter}>{h.after}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
