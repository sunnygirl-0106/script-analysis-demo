// 全部领域类型 —— 这是整个 demo 最重要的文件，数据模型即产品契约。

export type Stage = 'analysis' | 'visual' | 'studio'
export type ShotDensity = 'compact' | 'standard' | 'loose'

// ── 资产种类 ──
// 「可生产的基础资产」（第一批下发）与「关系资产」（着装角色）在类型上分开：
//   · BaseAssetKind：角色 / 服装 / 场景 / 道具 —— 第一批独立生产。
//   · look（着装角色）：角色 + 服装组合后的角色资产，后续批次生成，不进第一批。
export type BaseAssetKind = 'character' | 'costume' | 'location' | 'prop'
export type AssetKind = BaseAssetKind | 'look'
// 分镜挂载只认这三类：着装角色（人物参考）、场景、道具。独立服装不自动挂载。
export type MountKind = 'look' | 'location' | 'prop'

export interface Project {
  id: string
  title: string
  aspect: '16:9' | '9:16'
  style: 'realistic' | 'cinematic'
  defaultDensity: ShotDensity     // 新场 / 重拆本集的默认颗粒度。单场当前颗粒度存在 Scene.density
  stage: Stage                    // 走到哪个阶段，决定进入哪个页面（不再据此整页置灰）
  scriptRevision: number          // 脚本/分镜版本，从 1 起；每个脚本修改 action 成功后 +1
  productionSnapshot?: ProductionSnapshot // 第一次「资产生产」下发的下游快照（单向副本）
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

/** 挂载存 id，不存快照 —— 改资产名，所有挂过的地方自动跟着变。只挂着装角色 / 场景 / 道具 */
export interface MountRef {
  kind: MountKind
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
  description: string        // 一两行的识别摘要，不作为必填产品字段（不再称人物小传）
  imagePrompt: string        // 本轮资产页的主要可编辑字段
  appearances: Appearance[]  // 出场记录，由剧本决定，只读
  revision: number           // 上游定义版本，从 1 开始；改提示词即 +1
  productionRevision?: number // 最近一次进入生产快照时的 revision；缺省表示尚未下发
}

export interface Character extends AssetBase {
  kind: 'character'
  role: 'lead' | 'support' | 'extra'
}
// 服装是完全独立的基础资产，不保存「属于哪个角色」的反向归属。
// 「被哪些角色使用」通过 Look[] 派生。
export interface Costume extends AssetBase {
  kind: 'costume'
}
export interface Location extends AssetBase {
  kind: 'location'
  timeOfDay: string
}
// 删空后只剩 AssetBase 字段，保留 interface 不合并 —— 后续道具还会长字段。
export interface Prop extends AssetBase {
  kind: 'prop'
}

// 着装角色：角色 + 服装组合后的人物资产，是分镜里唯一的人物参考。
// characterId / costumeId 是 AI 分析结果，页面只读；改提示词不得改变这两个引用。
export interface Look extends AssetBase {
  kind: 'look'
  characterId: string
  costumeId: string
}

export type Asset = Character | Costume | Location | Prop | Look

// 构造 seed 资产时用的「未定版本」形态：revision / productionRevision 由 seed 组装阶段统一补齐，
// 避免在几十条资产字面量里逐个手写。DistributiveOmit 保留 kind 判别，字面量仍有字段级类型检查。
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never
export type AssetSeed = DistributiveOmit<Asset, 'revision' | 'productionRevision'>

// ── 项目级生产快照（仓库内部最小实现，不复制资产库完整模型）──
export interface ProductionSnapshotItem {
  sourceAssetId: string
  kind: BaseAssetKind
  name: string
  prompt: string
  sourceRevision: number
}

export interface ProductionSnapshot {
  createdAt: number
  sourceScriptRevision: number
  items: ProductionSnapshotItem[] // 仅第一批四类基础资产，永远不含 look
}

// ── 字段枚举（给 FieldSelect 下拉用）──
export const SHOT_SIZES = ['极特写', '特写', '近景', '中景', '全景', '远景'] as const
export const CAMERA_MOVES = [
  '定镜', '慢推', '快速推近', '拉远', '跟随', '低角度跟随',
  '手持', '摇摄', 'Rack Focus', '跳切',
] as const

// 提示词字段固定顺序（景别 → 焦段光圈 → 运镜 → 色温 → 色调），模型对顺序敏感。
export type ShotSize = (typeof SHOT_SIZES)[number]
export type CameraMove = (typeof CAMERA_MOVES)[number]
