// 全部领域类型 —— 这是整个 demo 最重要的文件，数据模型即产品契约。

export type Stage = 'analysis' | 'visual' | 'studio'
export type ShotDensity = 'compact' | 'standard' | 'loose'
export type AssetKind = 'character' | 'costume' | 'location' | 'prop'

export interface Project {
  id: string
  title: string
  aspect: '16:9' | '9:16'
  style: 'realistic' | 'cinematic'
  shotDensity: ShotDensity
  stage: Stage                    // 走到哪个阶段，决定前面的能不能改
  episodes: Episode[]
  scenes: Record<string, Scene>   // 扁平存，靠 id 引用
  shots: Record<string, Shot>
  assets: Record<string, Asset>   // 全剧唯一，这是「引用不是复制」的地基
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
  track: SceneTrack       // ★ 场级信息
}

/** ★ 场这一层自己的东西。这些内容跨镜，挂在单个镜上没有意义 */
export interface SceneTrack {
  bgm: string             // 配乐建议
  mood: string            // 这场的情绪走向
  fullDialogue: string    // 完整台词，连起来才能配音
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

/** 挂载存 id，不存快照 —— 改资产名，所有挂过的地方自动跟着变 */
export interface MountRef {
  kind: AssetKind
  assetId: string
}

export interface Appearance {
  episodeNo: number
  sceneNo: number
}

interface AssetBase {
  id: string
  kind: AssetKind
  name: string
  description: string        // 小传 / 外观描述
  imagePrompt: string        // 生图提示词
  appearances: Appearance[]  // 出场记录，由剧本决定，只读
}

export interface Character extends AssetBase {
  kind: 'character'
  role: 'lead' | 'support' | 'extra'
  skipImageGen: boolean      // ★「这个人不用生图」
}
export interface Costume extends AssetBase {
  kind: 'costume'
  characterId: string        // 服装挂在人物下面
}
export interface Location extends AssetBase {
  kind: 'location'
  timeOfDay: string
}
export interface Prop extends AssetBase {
  kind: 'prop'
  minor: boolean             // 次要道具，可跳过生图
}

export type Asset = Character | Costume | Location | Prop

// ── 字段枚举（给 FieldSelect 下拉用）──
export const SHOT_SIZES = ['极特写', '特写', '近景', '中景', '全景', '远景'] as const
export const CAMERA_MOVES = [
  '定镜', '慢推', '快速推近', '拉远', '跟随', '低角度跟随',
  '手持', '摇摄', 'Rack Focus', '跳切',
] as const

// 提示词字段固定顺序（景别 → 焦段光圈 → 运镜 → 色温 → 色调），模型对顺序敏感。
export type ShotSize = (typeof SHOT_SIZES)[number]
export type CameraMove = (typeof CAMERA_MOVES)[number]
