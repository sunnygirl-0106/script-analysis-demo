import type { Project, Scene } from '../data/types'

// 步骤③ 左侧目录的三种视图（v2.7 §五）。
//
// 为什么默认是全剧：拆完 25 镜，用户第一眼要回答的是「整部剧被拆成了什么样」，
// 而不是「第 1 场是什么样」。一场一场翻是聚焦动作，得由用户主动发起。
export type ViewScope =
  | { kind: 'project' }
  | { kind: 'episode'; episodeId: string }
  | { kind: 'scene'; sceneId: string }

/** 视图作用域下要铺开的场，按集序 → 场序。 */
export function scopeScenes(project: Project, scope: ViewScope): Scene[] {
  const pick = (ids: string[]) => ids.map((id) => project.scenes[id]).filter((sc): sc is Scene => !!sc)
  if (scope.kind === 'episode') {
    const ep = project.episodes.find((e) => e.id === scope.episodeId)
    if (ep) return pick(ep.sceneIds)
  }
  if (scope.kind === 'scene') {
    const sc = project.scenes[scope.sceneId]
    if (sc) return [sc]
  }
  // project 视图；同时是「作用域指向的集 / 场已被删掉」时的落点——回到全剧总比看一张空表好。
  return pick(project.episodes.flatMap((e) => e.sceneIds))
}

/** 面板标题用的前缀：全剧剧本 / 本集剧本 / 本场剧本。 */
export function scopeLabel(scope: ViewScope): string {
  return scope.kind === 'project' ? '全剧' : scope.kind === 'episode' ? '本集' : '本场'
}
