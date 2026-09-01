// 全部领域类型 —— 这是整个 demo 最重要的文件，数据模型即产品契约。

export type Stage = 'analysis' | 'visual' | 'studio'
export type ShotDensity = 'compact' | 'standard' | 'loose'

/** 提示词生成状态（UI 态，不进 Shot 数据模型）。
 *  pending 还没生成 / generating 生成中 / ready 已就绪 / stale 字段改动待重新生成。 */
export type PromptState = 'pending' | 'generating' | 'ready' | 'stale'
export type AssetKind = 'character' | 'costume' | 'location' | 'prop' | 'look'

/** 可被镜头挂载的类目。服装与角色素模不在其中（决策 3b）。
 *  character 保留为「AI 拆出了人但没给着装」的降级兜底，页面上会告警。 */
export type MountableKind = 'look' | 'location' | 'prop' | 'character'

/** 会进第一批出图的类目（决策 2b）。look 不在其中：着装角色要等素模与服装出图确认后再生成。 */
export const FIRST_BATCH_KINDS = ['character', 'costume', 'location', 'prop'] as const

export interface Project {
  id: string
  title: string
  aspect: '16:9' | '9:16'
  style: 'realistic' | 'cinematic'
  defaultDensity: ShotDensity     // 新场 / 重拆本集的默认颗粒度。单场当前颗粒度存在 Scene.density
  stage: Stage                    // 走到哪个阶段，决定进入哪个页面（不再据此整页置灰，改用能力矩阵）
  episodes: Episode[]
  scenes: Record<string, Scene>   // 扁平存，靠 id 引用
  shots: Record<string, Shot>
  assets: Record<string, Asset>   // 全剧唯一，这是「引用不是复制」的地基
  /** 首次「确认并保存到项目资产库」的时刻。null = 还没入过库。
   *  这是 replaceWholeScript 能力位与阶段②形态（完整确认 / 轻量增量）的唯一判据。 */
  libraryCommittedAt: number | null
}

export interface Episode {
  id: string
  no: number
  title: string
  sceneIds: string[]
}

export interface Scene {
  id: string
  episodeId: string
  no: number
  name: string            // 场名，可改
  location: string
  timeOfDay: string
  rawText: string         // 剧本原文，只读，界面上不给编辑入口
  shotIds: string[]
  density: ShotDensity    // ★ 本场当前的拆解颗粒度，重拆时写入
  track: SceneTrack       // ★ 场级信息
}

/** ★ 场这一层自己的东西。这些内容跨镜，挂在单个镜上没有意义 */
export interface SceneTrack {
  mood: string            // 情绪走向
  bgm: string             // 配乐建议 —— 只作为拍摄台整场配乐生成的输入，不下发到镜
}

export interface Shot {
  id: string
  sceneId: string
  no: number
  title: string           // 一句话摘要，表格里的扫读锚点
  duration: number        // 秒

  // ── 画面组 → 生关键帧 ──
  shotSize: string        // 景别（枚举）
  lens: string            // 焦段 + 光圈
  lighting: string        // 光影
  imagePrompt: string     // 画面描述

  // ── 视频组 → 生视频 ──
  cameraMove: string      // 运镜（枚举）
  dialogue: string        // 对白
  sfx: string             // 音效
  videoPrompt: string

  mounts: MountRef[]      // 挂载的是引用
  sourceQuote: string     // 本镜取材自剧本原文
}

/** 挂载存 id，不存快照 —— 改资产名，所有挂过的地方自动跟着变。只挂着装角色 / 场景 / 道具（+ 角色兜底）。 */
export interface MountRef {
  kind: MountableKind
  assetId: string
}

export interface Appearance {
  episodeNo: number
  sceneNo: number
}

interface AssetBase {
  id: string
  kind: AssetKind
  name: string               // 编目名（展示用），如「智能手机」
  aliases?: string[]         // 剧本原文里的真实叫法，如「手机」，供原文高亮匹配。name 本身自动参与匹配，不必重复列。
  imagePrompt: string        // 生图提示词

  // ❌ 删除 description（决策 4b）—— 页面上由「提示词摘要」顶替
  // ❌ 删除 appearances —— 改为从 mounts 派生，见 services/appearanceIndex.ts

  /** 提示词修订号。每次用户改提示词 +1，初始 0。 */
  promptRevision: number
  /** 交付给资产库那一刻的 promptRevision。未交付为 undefined。
   *  promptRevision > deliveredRevision ⇒ 提示词已改、下游图已过期（决策 1c）。 */
  deliveredRevision?: number
  /** 用户手动排除，不进出图队列。 */
  excluded?: boolean
}

export interface Character extends AssetBase {
  kind: 'character'
  role: 'lead' | 'support' | 'extra'   // 保留，扫读锚点
}

/** 服装是完全扁平的资产，不再持有归属（决策 3a）—— 归属由 look 表达。 */
export interface Costume extends AssetBase {
  kind: 'costume'
}

export interface Location extends AssetBase {
  kind: 'location'
  timeOfDay: string   // 保留为展示标签，不做任何合并 / 矩阵逻辑（决策 4a）
}

// 删空后只剩 AssetBase 字段，保留 interface 不合并 —— 后续道具还会长字段。
export interface Prop extends AssetBase {
  kind: 'prop'
}

/** ★ 新增：着装角色。AI 拆解产出，绑定关系永久只读（决策 1b）。 */
export interface Look extends AssetBase {
  kind: 'look'
  characterId: string
  /** 可 0 件（默认着装）、可多件（上衣 + 裤 + 帽打包）。不限制归属（决策 3a）。 */
  costumeIds: string[]
}

export type Asset = Character | Costume | Location | Prop | Look

// ── 字段枚举（给 FieldSelect 下拉用）──
export const SHOT_SIZES = ['极特写', '特写', '近景', '中景', '全景', '远景'] as const
export const CAMERA_MOVES = [
  '定镜', '慢推', '快速推近', '拉远', '跟随', '低角度跟随',
  '手持', '摇摄', 'Rack Focus', '跳切',
] as const
