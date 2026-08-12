// 全部领域类型 —— 这是整个 demo 最重要的文件，数据模型即产品契约。

export type Stage = 'analysis' | 'visual' | 'studio'
export type ShotDensity = 'compact' | 'standard' | 'loose'
export type AssetKind = 'character' | 'costume' | 'location' | 'prop'

export interface Project {
  id: string
  title: string
  aspect: '16:9' | '9:16'
  style: 'realistic' | 'cinematic'
  defaultDensity: ShotDensity     // 新场 / 重拆本集的默认颗粒度。单场当前颗粒度存在 Scene.density
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
  name: string               // 编目名（展示用），如「智能手机」
  aliases?: string[]         // 剧本原文里的真实叫法，如「手机」，供原文高亮匹配。name 本身自动参与匹配，不必重复列。
  description: string        // 小传 / 外观描述
  imagePrompt: string        // 生图提示词
  appearances: Appearance[]  // 出场记录，由剧本决定，只读
}

export interface Character extends AssetBase {
  kind: 'character'
  role: 'lead' | 'support' | 'extra'
}
// 服装是独立资产（历史数据兼容）。角色素模是视觉筹备内部中间产物，不建资产、不可挂载。
export interface Costume extends AssetBase {
  kind: 'costume'
  characterId: string        // 服装挂在角色下面
}
export interface Location extends AssetBase {
  kind: 'location'
  timeOfDay: string
}
// 删空后只剩 AssetBase 字段，保留 interface 不合并 —— 后续道具还会长字段。
export interface Prop extends AssetBase {
  kind: 'prop'
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
