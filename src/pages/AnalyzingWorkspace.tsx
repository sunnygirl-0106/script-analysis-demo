import { useStore } from '../store/useStore'
import { EpisodeTree } from '../components/EpisodeTree'
import { ScriptPanel } from '../components/ScriptPanel'
import { TabBar } from '../components/TabBar'
import { AssetList } from '../components/AssetList'
import { Storyboard } from '../components/Storyboard'
import { AnalyzeHud } from '../components/AnalyzeHud'
import { sceneDuration } from '../services/timeline'
import { STAGE_PROGRESS } from '../services/analysisTimeline'
import type { AssetKind } from '../data/types'
import sa from './ScriptAnalysis.module.css'
import s from './AnalyzingWorkspace.module.css'

// 解析中的工作区：复用真实子组件，按 revealStage 分区错峰揭示；整体不可交互，纯观赏。
// 数据（seed）始终完整，这里只做呈现层揭示 —— 无数据一致性风险。
// 主内容区在分镜就绪（stage≥3）前，一直显示 AnalyzeHud 加载态（转圈圈 + 进度 + checklist）。
export function AnalyzingWorkspace() {
  const project = useStore((st) => st.project)
  const stage = useStore((st) => st.revealStage)
  const sceneId = useStore((st) => st.selectedSceneId)
  const activeTab = useStore((st) => st.activeTab)

  const scene = project.scenes[sceneId]
  const shotTotal = Object.values(project.scenes).reduce((n, sc) => n + sc.shotIds.length, 0)
  const durTotal = Object.values(project.scenes).reduce((n, sc) => n + sceneDuration(sc, project.shots), 0)
  const pct = STAGE_PROGRESS[Math.min(stage, STAGE_PROGRESS.length - 1)]

  const showBoard = stage >= 3 && scene

  return (
    <div className={[sa.page, s.frozen].join(' ')} data-analyzing="" data-reveal={stage}>
      {/* 左：集·场目录（stage≥1 揭示，之前是骨架） */}
      {stage >= 1 ? (
        <div className={s.region}>
          <EpisodeTree />
        </div>
      ) : (
        <SkeletonDir />
      )}

      {/* 本场剧本：stage≥2 展开（scriptOpen 由控制器置真） */}
      {stage >= 2 && (
        <div className={[s.region, s.regionScript].join(' ')}>
          <ScriptPanel />
        </div>
      )}

      <div className={sa.rcol}>
        <div className={sa.toolbar}>
          {stage >= 1 && (
            <div className={s.region}>
              <TabBar scene={scene} />
            </div>
          )}
        </div>

        {/* 分镜/资产开始铺陈后，顶部保留一条细进度，延续「解析中」反馈 */}
        {stage >= 3 && (
          <div className={s.topProgress}>
            <span className={s.topFill} style={{ width: `${pct}%` }} />
          </div>
        )}

        <div className={sa.paneScroll}>
          {activeTab === 'shot' ? (
            showBoard ? (
              <div className={s.region} key="sb">
                <Storyboard scene={scene} readOnly />
              </div>
            ) : (
              // stage 0–2：主面板加载态（转圈圈 + 进度 + 四步 checklist）
              <AnalyzeHud />
            )
          ) : (
            <div className={s.region} key={activeTab}>
              <AssetList kind={activeTab as AssetKind} sort="first" />
            </div>
          )}
        </div>

        {stage >= 4 && (
          <div className={[sa.foot, s.region].join(' ')}>
            <div className={sa.info}>
              全剧 <b>{project.episodes.length} 集</b> · <b>{Object.keys(project.scenes).length} 场</b> ·{' '}
              <b>{shotTotal} 个镜头</b> · 约 {durTotal} 秒
            </div>
            <span className={s.footNote}>正在整理角色 · 服装 · 场景 · 道具…</span>
          </div>
        )}
      </div>
    </div>
  )
}

// 目录骨架（对齐参考稿 2b「目录生成中…」）
function SkeletonDir() {
  return (
    <div className={s.skDir}>
      <div className={s.skDirHead}>
        <span className={s.skBar} style={{ width: 52 }} />
        <span className={s.skBar} style={{ width: 20 }} />
      </div>
      <div className={s.skDirList}>
        {[100, 70, 84, 60, 56, 66].map((w, i) => (
          <div className={s.skRow} key={i} style={{ paddingLeft: i === 0 ? 0 : 15 }}>
            {i === 0 && <span className={s.skDot} />}
            <span className={s.skBar} style={{ width: `${w}%` }} />
          </div>
        ))}
      </div>
      <div className={s.skDirFoot}>目录生成中…</div>
    </div>
  )
}
