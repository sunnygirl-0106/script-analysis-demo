import { useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { useClickOutside } from '../hooks/useClickOutside'
import { can } from '../services/capability'
import { sceneDuration } from '../services/timeline'
import { ScriptImportDialog } from './ScriptImportDialog'
import { ResplitEpisodeDialog } from './ResplitEpisodeDialog'
import ui from '../styles/ui.module.css'
import di from './ScriptImportDialog.module.css'
import s from './EpisodeTree.module.css'

type Dialog =
  | { type: 'resplit'; epId: string }
  | { type: 'append' }
  | { type: 'replace'; epId: string }
  | { type: 'delete'; epId: string }
  | null

export function EpisodeTree() {
  const project = useStore((st) => st.project)
  const selectedSceneId = useStore((st) => st.selectedSceneId)
  const selectScene = useStore((st) => st.selectScene)
  const deleteEpisode = useStore((st) => st.deleteEpisode)
  const usageIndex = useStore((st) => st.usageIndex())
  const readOnly = !useStore((st) => can(st.project, 'editScript'))

  const [menuEp, setMenuEp] = useState<string | null>(null)
  const [dialog, setDialog] = useState<Dialog>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  useClickOutside(menuRef, () => setMenuEp(null), menuEp !== null)

  const episodeCount = project.episodes.length
  const sceneCount = Object.keys(project.scenes).length
  const onlyOne = episodeCount <= 1

  const delEp = dialog?.type === 'delete' ? project.episodes.find((e) => e.id === dialog.epId) : undefined
  const delStat = delEp
    ? (() => {
        const scenes = delEp.sceneIds.map((id) => project.scenes[id]).filter(Boolean)
        const shots = scenes.reduce((n, sc) => n + sc!.shotIds.length, 0)
        const onlyInEp = Object.values(project.assets).filter((a) => {
          const apps = usageIndex[a.id]?.appearances ?? []
          return apps.length > 0 && apps.every((ap) => ap.episodeNo === delEp.no)
        }).length
        return { scenes: scenes.length, shots, onlyInEp }
      })()
    : null

  return (
    <div className={s.side}>
      <div className={s.head}>
        集 · 场
        <span className={s.rt}>
          {episodeCount} 集 · {sceneCount} 场
        </span>
      </div>
      <div className={s.tree}>
        {project.episodes.map((ep, ei) => {
          const scenes = ep.sceneIds.map((id) => project.scenes[id]!).filter(Boolean)
          const shotTotal = scenes.reduce((n, sc) => n + sc.shotIds.length, 0)
          const durTotal = scenes.reduce((n, sc) => n + sceneDuration(sc, project.shots), 0)
          return (
            <div key={ep.id}>
              {ei > 0 && <div className={s.epgap} />}
              <div className={s.ep}>
                <div className={s.epMain}>
                  <div className={s.epTitle}>
                    第 {ep.no} 集 · {ep.title}
                  </div>
                  <div className={s.epSub}>
                    {scenes.length} 场 · {shotTotal} 镜 · {durTotal}s
                  </div>
                </div>
                {!readOnly && (
                  <div className={s.menuWrap} ref={menuEp === ep.id ? menuRef : undefined}>
                    <button
                      className={s.dots}
                      title="本集操作"
                      onClick={() => setMenuEp((m) => (m === ep.id ? null : ep.id))}
                    >
                      ⋯
                    </button>
                    {menuEp === ep.id && (
                      <div className={s.menu}>
                        <button
                          className={s.menuItem}
                          onClick={() => {
                            setDialog({ type: 'resplit', epId: ep.id })
                            setMenuEp(null)
                          }}
                        >
                          重新拆分本集
                        </button>
                        <button
                          className={s.menuItem}
                          onClick={() => {
                            setDialog({ type: 'append' })
                            setMenuEp(null)
                          }}
                        >
                          追加剧集
                        </button>
                        <button
                          className={s.menuItem}
                          onClick={() => {
                            setDialog({ type: 'replace', epId: ep.id })
                            setMenuEp(null)
                          }}
                        >
                          替换本集
                        </button>
                        <button
                          className={[s.menuItem, s.menuDanger].join(' ')}
                          disabled={onlyOne}
                          title={onlyOne ? '项目中至少需要保留 1 集，暂时无法删除' : undefined}
                          onClick={() => {
                            if (onlyOne) return
                            setDialog({ type: 'delete', epId: ep.id })
                            setMenuEp(null)
                          }}
                        >
                          删除本集
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {scenes.map((sc) => (
                <div
                  key={sc.id}
                  className={[s.sc, sc.id === selectedSceneId ? s.on : ''].join(' ')}
                  onClick={() => selectScene(sc.id)}
                >
                  第 {sc.no} 场 {sc.name}
                  <span className={s.d}>{sc.shotIds.length} 镜</span>
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {/* 集级弹窗 */}
      {dialog?.type === 'resplit' && (
        <ResplitEpisodeDialog episodeId={dialog.epId} onClose={() => setDialog(null)} />
      )}
      <ScriptImportDialog
        open={dialog?.type === 'append'}
        scope="project"
        defaultMode="append"
        onClose={() => setDialog(null)}
      />
      <ScriptImportDialog
        open={dialog?.type === 'replace'}
        scope="episode"
        defaultMode="overwrite"
        episodeId={dialog?.type === 'replace' ? dialog.epId : undefined}
        onClose={() => setDialog(null)}
      />

      {dialog?.type === 'delete' && delEp && delStat && (
        <div className={di.overlay} onClick={() => setDialog(null)}>
          <div className={di.dialog} onClick={(e) => e.stopPropagation()}>
            <div className={di.title}>删除第 {delEp.no} 集？</div>
            <div className={di.danger}>
              将同时删除本集的 {delStat.scenes} 场 {delStat.shots} 个镜头。本集独有的 {delStat.onlyInEp} 项角色、服装、场景和道具也会被删除；其他剧集仍在使用的内容会保留。此操作不可撤销。
            </div>
            <div className={di.actions}>
              <button className={ui.btn} onClick={() => setDialog(null)}>
                取消
              </button>
              <button
                className={[ui.btn, ui.btnDanger].join(' ')}
                onClick={() => {
                  deleteEpisode(delEp.id)
                  setDialog(null)
                }}
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
