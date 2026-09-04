import { useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { Dialog } from './Dialog'
import { useStore } from '../store/useStore'
import { clampToViewport } from '../services/popover'
import { useClickOutside } from '../hooks/useClickOutside'
import { can } from '../services/capability'
import { ResplitSceneDialog } from './ResplitSceneDialog'
import { ic } from './icons'
import ui from '../styles/ui.module.css'
import di from '../styles/dialog.module.css'
import m from '../styles/menu.module.css'
import s from './EpisodeTree.module.css'

// 集行右侧不再挂 ⋯ 菜单：追加剧集、替换本集剧本、重新拆分本集镜头都退役了，
// 只剩「删除本集」一项——一个只有一项的菜单不如直接给那一项，所以换成一颗垃圾桶，
// 与整理剧本页的集头、场行 ⋯ 一样悬停才现形。
// 重拆的粒度回到「场」：整集一键重拆改动面太大，用户判断不了结果对不对。
// 补充剧本的唯一入口在步骤① 整理剧本页的 ⋯ 里。
type Dialog =
  | { type: 'delete'; epId: string }
  | { type: 'deleteScene'; sceneId: string }
  | { type: 'resplitScene'; sceneId: string }
  | null

export function EpisodeTree() {
  const project = useStore((st) => st.project)
  const viewScope = useStore((st) => st.viewScope)
  const setViewScope = useStore((st) => st.setViewScope)
  const selectScene = useStore((st) => st.selectScene)
  const renameScene = useStore((st) => st.renameScene)
  const deleteScene = useStore((st) => st.deleteScene)
  const deleteEpisode = useStore((st) => st.deleteEpisode)
  const usageIndex = useStore((st) => st.usageIndex())
  const episodeW = useStore((st) => st.episodeW)
  const readOnly = !useStore((st) => can(st.project, 'editScript'))

  const [menuScene, setMenuScene] = useState<string | null>(null)
  // 菜单固定定位：在光标/按钮的右下方弹出，脱离窄侧栏的 overflow 裁剪，并夹在视口内。
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null)
  const openMenuAt = (x: number, y: number) => {
    const { left, top } = clampToViewport(x, y, { w: 182, h: 120 })
    setMenuPos({ x: left, y: top })
  }
  const openMenuFromBtn = (e: ReactMouseEvent) => {
    const r = e.currentTarget.getBoundingClientRect()
    openMenuAt(r.left, r.bottom + 4)
  }
  const [dialog, setDialog] = useState<Dialog>(null)
  // 就地改场名：记录正在编辑的场 id 与草稿。
  const [editScene, setEditScene] = useState<string | null>(null)
  const [nameDraft, setNameDraft] = useState('')

  const startRename = (id: string, name: string) => {
    setEditScene(id)
    setNameDraft(name)
  }
  const commitRename = () => {
    if (editScene) renameScene(editScene, nameDraft)
    setEditScene(null)
  }
  const menuSceneRef = useRef<HTMLDivElement>(null)
  useClickOutside(menuSceneRef, () => setMenuScene(null), menuScene !== null)

  const onlyOne = project.episodes.length <= 1
  // 目录三层（全剧 / 集 / 场）只报一个单位：镜。顶行报全剧总镜数，场行报本场镜数，
  // 集行一个数都不报——名字底下再挂一行「N 场 · N 镜 · Ns」就成了第三处报数（v2.8 §5）。
  const allShots = Object.values(project.scenes).reduce((n, sc) => n + sc.shotIds.length, 0)

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

  // 单场删除确认：本场镜数 + 仅在本场出现的独有资产数。
  const delSc = dialog?.type === 'deleteScene' ? project.scenes[dialog.sceneId] : undefined
  const delScEp = delSc ? project.episodes.find((e) => e.sceneIds.includes(delSc.id)) : undefined
  const delScStat =
    delSc && delScEp
      ? {
          shots: delSc.shotIds.length,
          onlyInScene: Object.values(project.assets).filter((a) => {
            const apps = usageIndex[a.id]?.appearances ?? []
            return apps.length > 0 && apps.every((ap) => ap.episodeNo === delScEp.no && ap.sceneNo === delSc.no)
          }).length,
        }
      : null

  return (
    <div className={s.side} style={{ width: episodeW }}>
      <div className={s.tree}>
        {/* 顶行「全剧」= 全剧视图，同时替代原来那条标题栏（v2.8 §5）。
            目录里恰有一行是选中态，由 viewScope 判。 */}
        <button
          className={[s.ep, s.allRow, viewScope.kind === 'project' ? s.on : ''].join(' ')}
          onClick={() => setViewScope({ kind: 'project' })}
        >
          <span className={s.epTitle}>全剧</span>
          <span className={s.allMeta}>{allShots} 镜</span>
        </button>
        <div className={s.topSep} />
        {project.episodes.map((ep, ei) => {
          const scenes = ep.sceneIds.map((id) => project.scenes[id]!).filter(Boolean)
          return (
            <div key={ep.id}>
              {ei > 0 && <div className={s.epgap} />}
              <div className={[s.ep, viewScope.kind === 'episode' && viewScope.episodeId === ep.id ? s.on : ''].join(' ')}>
                {/* 点集标题文字 = 本集视图；右侧一颗垃圾桶 = 删除本集（悬停本行才现形）。 */}
                <button className={s.epMain} onClick={() => setViewScope({ kind: 'episode', episodeId: ep.id })}>
                  <span className={s.epTitle}>
                    第 {ep.no} 集 · {ep.title}
                  </span>
                </button>
                {!readOnly && (
                  <button
                    className={s.epDel}
                    disabled={onlyOne}
                    title={onlyOne ? '项目中至少需要保留 1 集，暂时无法删除' : '删除本集'}
                    aria-label="删除本集"
                    onClick={() => setDialog({ type: 'delete', epId: ep.id })}
                  >
                    {ic.trash}
                  </button>
                )}
              </div>
              {scenes.map((sc) => (
                <div className={s.scWrap} key={sc.id}>
                  <div
                    className={[s.sc, viewScope.kind === 'scene' && viewScope.sceneId === sc.id ? s.on : ''].join(' ')}
                    onClick={() => setViewScope({ kind: 'scene', sceneId: sc.id })}
                    onDoubleClick={readOnly ? undefined : () => startRename(sc.id, sc.name)}
                    onContextMenu={
                      readOnly
                        ? undefined
                        : (e) => {
                            e.preventDefault()
                            openMenuAt(e.clientX, e.clientY)
                            setMenuScene(sc.id)
                          }
                    }
                    title={readOnly ? undefined : '双击改场名 · 右键或 ⋯ 更多操作'}
                  >
                    第 {sc.no} 场{' '}
                    {editScene === sc.id ? (
                      <input
                        className={s.scInput}
                        value={nameDraft}
                        autoFocus
                        spellCheck={false}
                        onChange={(e) => setNameDraft(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onFocus={(e) => e.target.select()}
                        onBlur={commitRename}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename()
                          else if (e.key === 'Escape') setEditScene(null)
                        }}
                      />
                    ) : (
                      sc.name
                    )}
                    <span className={s.d}>{sc.shotIds.length} 镜</span>
                  </div>
                  {!readOnly && (
                    <div className={s.scMenuWrap} ref={menuScene === sc.id ? menuSceneRef : undefined}>
                      <button
                        className={[s.scDots, menuScene === sc.id ? s.scDotsOn : ''].join(' ')}
                        title="本场操作"
                        onClick={(e) => {
                          e.stopPropagation()
                          openMenuFromBtn(e)
                          setMenuScene((m) => (m === sc.id ? null : sc.id))
                        }}
                      >
                        ⋯
                      </button>
                      {menuScene === sc.id && menuPos && (
                        <div className={s.menuAt} style={{ left: menuPos.x, top: menuPos.y }}>
                          <button
                            className={m.item}
                            onClick={() => {
                              startRename(sc.id, sc.name)
                              setMenuScene(null)
                            }}
                          >
                            <i className={m.icon}>{ic.rename}</i>重命名
                          </button>
                          <button
                            className={m.item}
                            onClick={() => {
                              selectScene(sc.id)
                              setDialog({ type: 'resplitScene', sceneId: sc.id })
                              setMenuScene(null)
                            }}
                          >
                            <i className={m.icon}>{ic.resplit}</i>重新拆分本场镜头
                          </button>
                          <div className={m.sep} />
                          <button
                            className={[m.item, m.danger].join(' ')}
                            onClick={() => {
                              setMenuScene(null)
                              // 空场无级联（没有镜头就不会有「仅在本场出现」的资产），直接删，不打扰。
                              if (sc.shotIds.length === 0) deleteScene(sc.id)
                              else setDialog({ type: 'deleteScene', sceneId: sc.id })
                            }}
                          >
                            <i className={m.icon}>{ic.trash}</i>删除本场
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {/* 集级弹窗 */}
      {dialog?.type === 'delete' && delEp && delStat && (
        <Dialog onClose={() => setDialog(null)} className={di.dialog}>
          <div className={di.title}>删除第 {delEp.no} 集</div>
          <div className={di.desc}>
            将同时删除本集的 {delStat.scenes} 场 {delStat.shots} 个镜头。本集独有的 {delStat.onlyInEp} 项角色、服装、场景和道具会变为「未引用」，但仍保留在项目资产库中——删除资产的唯一入口是资产库本身。此操作不可撤销。
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
        </Dialog>
      )}

      {/* 场级弹窗 */}
      {dialog?.type === 'resplitScene' && (
        <ResplitSceneDialog sceneId={dialog.sceneId} onClose={() => setDialog(null)} />
      )}

      {dialog?.type === 'deleteScene' && delSc && delScStat && (
        <Dialog onClose={() => setDialog(null)} className={di.dialog}>
          <div className={di.title}>删除第 {delSc.no} 场「{delSc.name}」</div>
          <div className={di.desc}>
            将同时删除本场的 {delScStat.shots} 个镜头
            {delScStat.onlyInScene > 0
              ? `，以及仅在本场出现的 ${delScStat.onlyInScene} 项独有资产。其他场仍在使用的内容会保留`
              : ''}
            。此操作不可撤销。
          </div>
          <div className={di.actions}>
            <button className={ui.btn} onClick={() => setDialog(null)}>
              取消
            </button>
            <button
              className={[ui.btn, ui.btnDanger].join(' ')}
              onClick={() => {
                deleteScene(delSc.id)
                setDialog(null)
              }}
            >
              删除
            </button>
          </div>
        </Dialog>
      )}
    </div>
  )
}
