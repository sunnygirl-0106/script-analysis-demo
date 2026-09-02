import { useRef, useState, type ReactNode, type MouseEvent as ReactMouseEvent } from 'react'
import { useStore } from '../store/useStore'
import { useClickOutside } from '../hooks/useClickOutside'
import { can } from '../services/capability'
import { sceneDuration } from '../services/timeline'
import { ResplitEpisodeDialog } from './ResplitEpisodeDialog'
import { ResplitSceneDialog } from './ResplitSceneDialog'
import ui from '../styles/ui.module.css'
import di from '../styles/dialog.module.css'
import s from './EpisodeTree.module.css'

// 菜单项左侧的灰色小图标：统一 24×24 描边风格（对齐 AppShell / ShotRow）。
const svg = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth={1.7}>
    {d}
  </svg>
)
const ic = {
  rename: svg(
    <>
      <path d="M4 20h4L19 9a2 2 0 0 0-3-3L5 17v3z" strokeLinejoin="round" />
      <path d="M14 7l3 3" strokeLinecap="round" />
    </>,
  ),
  insert: svg(
    <>
      <path d="M4 9h16" strokeLinecap="round" />
      <path d="M12 13.5v6M9 16.5h6" strokeLinecap="round" />
    </>,
  ),
  resplit: svg(
    <>
      <circle cx="6.5" cy="7" r="2" />
      <circle cx="6.5" cy="17" r="2" />
      <path d="M8.3 8.1 20 15.5M8.3 15.9 20 8.5" strokeLinecap="round" />
    </>,
  ),
  trash: svg(<path d="M5 7h14M10 7V5h4v2M6 7l1 12h10l1-12" strokeLinecap="round" strokeLinejoin="round" />),
}

// 集级菜单只剩「重新拆分本集镜头 / 删除本集」——
// 追加剧集与替换本集剧本都退役了，补充剧本的唯一入口在步骤① 整理剧本页的 ⋯ 里。
type Dialog =
  | { type: 'resplit'; epId: string }
  | { type: 'delete'; epId: string }
  | { type: 'deleteScene'; sceneId: string }
  | { type: 'resplitScene'; sceneId: string }
  | null

export function EpisodeTree() {
  const project = useStore((st) => st.project)
  const viewScope = useStore((st) => st.viewScope)
  const setViewScope = useStore((st) => st.setViewScope)
  const selectScene = useStore((st) => st.selectScene)
  const insertScene = useStore((st) => st.insertScene)
  const renameScene = useStore((st) => st.renameScene)
  const deleteScene = useStore((st) => st.deleteScene)
  const deleteEpisode = useStore((st) => st.deleteEpisode)
  const usageIndex = useStore((st) => st.usageIndex())
  const episodeW = useStore((st) => st.episodeW)
  const readOnly = !useStore((st) => can(st.project, 'editScript'))

  const [menuEp, setMenuEp] = useState<string | null>(null)
  const [menuScene, setMenuScene] = useState<string | null>(null)
  // 菜单固定定位：在光标/按钮的右下方弹出，脱离窄侧栏的 overflow 裁剪，并夹在视口内。
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null)
  const openMenuAt = (x: number, y: number) => {
    const w = 182
    const h = 120
    const pad = 8
    setMenuPos({
      x: Math.min(x, window.innerWidth - w - pad),
      y: Math.min(y, window.innerHeight - h - pad),
    })
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
  const menuRef = useRef<HTMLDivElement>(null)
  useClickOutside(menuRef, () => setMenuEp(null), menuEp !== null)
  const menuSceneRef = useRef<HTMLDivElement>(null)
  useClickOutside(menuSceneRef, () => setMenuScene(null), menuScene !== null)

  const episodeCount = project.episodes.length
  const sceneCount = Object.keys(project.scenes).length
  const onlyOne = episodeCount <= 1
  // 顶行「全部镜头」的总量：目录里三种行都报 `N 镜 · Ns`，口径一致才好横向比。
  const allScenes = Object.values(project.scenes)
  const allShots = allScenes.reduce((n, sc) => n + sc.shotIds.length, 0)
  const allDur = allScenes.reduce((n, sc) => n + sceneDuration(sc, project.shots), 0)

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
      <div className={s.head}>
        集 · 场
        <span className={s.rt}>
          {episodeCount} 集 · {sceneCount} 场
        </span>
      </div>
      <div className={s.tree}>
        {/* 顶行「全部镜头」= 全剧视图（v2.7 §5.3）。目录里恰有一行是选中态，由 viewScope 判。 */}
        <button
          className={[s.allRow, viewScope.kind === 'project' ? s.on : ''].join(' ')}
          onClick={() => setViewScope({ kind: 'project' })}
        >
          全部镜头
          <span className={s.allMeta}>{allShots} 镜 · {allDur}s</span>
        </button>
        {project.episodes.map((ep, ei) => {
          const scenes = ep.sceneIds.map((id) => project.scenes[id]!).filter(Boolean)
          const shotTotal = scenes.reduce((n, sc) => n + sc.shotIds.length, 0)
          const durTotal = scenes.reduce((n, sc) => n + sceneDuration(sc, project.shots), 0)
          return (
            <div key={ep.id}>
              {ei > 0 && <div className={s.epgap} />}
              <div className={[s.ep, viewScope.kind === 'episode' && viewScope.episodeId === ep.id ? s.on : ''].join(' ')}>
                {/* 点集标题文字 = 本集视图；⋯ 菜单（重拆 / 删除）不变（v2.7 §5.3）。 */}
                <button className={s.epMain} onClick={() => setViewScope({ kind: 'episode', episodeId: ep.id })}>
                  <span className={s.epTitle}>
                    第 {ep.no} 集 · {ep.title}
                  </span>
                  <span className={s.epSub}>
                    {scenes.length} 场 · {shotTotal} 镜 · {durTotal}s
                  </span>
                </button>
                {!readOnly && (
                  <div className={s.menuWrap} ref={menuEp === ep.id ? menuRef : undefined}>
                    <button
                      className={s.dots}
                      title="本集操作"
                      onClick={(e) => {
                        openMenuFromBtn(e)
                        setMenuEp((m) => (m === ep.id ? null : ep.id))
                      }}
                    >
                      ⋯
                    </button>
                    {menuEp === ep.id && menuPos && (
                      <div className={s.menu} style={{ left: menuPos.x, top: menuPos.y }}>
                        <button
                          className={s.menuItem}
                          onClick={() => {
                            setDialog({ type: 'resplit', epId: ep.id })
                            setMenuEp(null)
                          }}
                        >
                          <i className={s.mIcon}>{ic.resplit}</i>重新拆分本集镜头
                        </button>
                        <div className={s.menuSep} />
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
                          <i className={s.mIcon}>{ic.trash}</i>删除本集
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {scenes.map((sc, si) => (
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
                    <span className={s.d}>
                      {sc.shotIds.length} 镜 · {sceneDuration(sc, project.shots)}s
                    </span>
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
                        <div className={s.menu} style={{ left: menuPos.x, top: menuPos.y }}>
                          <button
                            className={s.menuItem}
                            onClick={() => {
                              startRename(sc.id, sc.name)
                              setMenuScene(null)
                            }}
                          >
                            <i className={s.mIcon}>{ic.rename}</i>重命名
                          </button>
                          <button
                            className={s.menuItem}
                            onClick={() => {
                              insertScene(ep.id, si + 1)
                              setMenuScene(null)
                            }}
                          >
                            <i className={s.mIcon}>{ic.insert}</i>在下方插入一场
                          </button>
                          <button
                            className={s.menuItem}
                            onClick={() => {
                              selectScene(sc.id)
                              setDialog({ type: 'resplitScene', sceneId: sc.id })
                              setMenuScene(null)
                            }}
                          >
                            <i className={s.mIcon}>{ic.resplit}</i>重新拆分本场镜头
                          </button>
                          <div className={s.menuSep} />
                          <button
                            className={[s.menuItem, s.menuDanger].join(' ')}
                            onClick={() => {
                              setMenuScene(null)
                              // 空场无级联（没有镜头就不会有「仅在本场出现」的资产），直接删，不打扰。
                              if (sc.shotIds.length === 0) deleteScene(sc.id)
                              else setDialog({ type: 'deleteScene', sceneId: sc.id })
                            }}
                          >
                            <i className={s.mIcon}>{ic.trash}</i>删除本场
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
      {dialog?.type === 'resplit' && (
        <ResplitEpisodeDialog episodeId={dialog.epId} onClose={() => setDialog(null)} />
      )}

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

      {/* 场级弹窗 */}
      {dialog?.type === 'resplitScene' && (
        <ResplitSceneDialog sceneId={dialog.sceneId} onClose={() => setDialog(null)} />
      )}

      {dialog?.type === 'deleteScene' && delSc && delScStat && (
        <div className={di.overlay} onClick={() => setDialog(null)}>
          <div className={di.dialog} onClick={(e) => e.stopPropagation()}>
            <div className={di.title}>删除第 {delSc.no} 场「{delSc.name}」？</div>
            <div className={di.danger}>
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
          </div>
        </div>
      )}
    </div>
  )
}
