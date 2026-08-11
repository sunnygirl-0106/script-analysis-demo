import { useStore } from '../store/useStore'
import type { Shot } from '../data/types'
import { SHOT_SIZES, CAMERA_MOVES } from '../data/types'
import { FieldSelect } from './FieldSelect'
import { PromptSections } from './PromptSections'
import s from './ShotDetail.module.css'

export function ShotDetail({ shot }: { shot: Shot }) {
  const canEdit = useStore((st) => st.canEditAnalysis())
  const updateField = useStore((st) => st.updateShotField)

  return (
    <div className={s.in}>
      <div className={s.dgrid}>
        {/* 画面提示词 → 生关键帧 */}
        <div className={s.dbox}>
          <div className={s.h}>
            <b>画面提示词</b>
            <em>→ 拍摄台 · 生关键帧</em>
          </div>
          <div className={s.fl}>
            <FieldSelect
              label="景别"
              value={shot.shotSize}
              options={SHOT_SIZES}
              readOnly={!canEdit}
              onChange={(v) => updateField(shot.id, 'shotSize', v)}
            />
            <FieldSelect label="镜头" value={shot.lens} options={[shot.lens]} readOnly onChange={() => {}} />
            <FieldSelect label="光影" value={shot.lighting} options={[shot.lighting]} readOnly onChange={() => {}} />
          </div>
          <div className={s.c2}><PromptSections text={shot.imagePrompt} /></div>
        </div>

        {/* 视频提示词 → 生视频 */}
        <div className={s.dbox}>
          <div className={s.h}>
            <b>视频提示词</b>
            <em>→ 拍摄台 · 生视频（含同期声）</em>
          </div>
          <div className={s.fl}>
            <FieldSelect
              label="运镜"
              value={shot.cameraMove}
              options={CAMERA_MOVES}
              readOnly={!canEdit}
              onChange={(v) => updateField(shot.id, 'cameraMove', v)}
            />
            <FieldSelect label="对白" value={shot.dialogue} options={[shot.dialogue]} readOnly onChange={() => {}} />
            <FieldSelect label="音效" value={shot.sfx} options={[shot.sfx]} readOnly onChange={() => {}} />
          </div>
          <div className={s.c2}><PromptSections text={shot.videoPrompt} /></div>
        </div>
      </div>
    </div>
  )
}
