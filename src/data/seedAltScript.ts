// 覆盖导入演示用的「另一个剧本」《退货风波》：1 集 2 场 5 镜。
// 复用现有第 2 集内容改写而成，全部新建独立 id（覆盖是换项目，不做去重）。
// 提示词直接引用 PROMPTS 里 ep2 那 5 条，不新写。
import type { Asset, AssetKind, Episode, Look, MountableKind, MountRef, Scene, Shot } from './types'
import type { ScriptPayload } from '../services/replace'
import { buildEpisodeRawText } from './seed'
import { PROMPTS } from './prompts'

// ── 独立资产 id（不与被覆盖的旧项目撞车）──
const X = {
  suke: 'alt_c_suke',
  courier: 'alt_c_courier',
  hoodie: 'alt_cos_hoodie',
  living: 'alt_loc_living',
  entry: 'alt_loc_entry',
  parcel: 'alt_p_parcel',
  lookSuke: 'alt_lk_suke_hoodie',
} as const

const altAssets: Asset[] = [
  {
    id: X.suke, kind: 'character', role: 'lead',
    name: '苏可',
    imagePrompt: '一张高精度、干净极简的角色基础视觉资产设定板。纯白背景，横版构图，三视图（正面 / 左侧 / 背面全身站姿）。24 岁东亚女性，精致甜美初恋脸，黑色中长发微卷。中性棚拍光，无遮挡，完整人物不裁切。',
    promptRevision: 0,
  },
  {
    id: X.courier, kind: 'character', role: 'extra',
    name: '快递员', aliases: ['快递'],
    imagePrompt: '一张高精度、干净极简的角色基础视觉资产设定板。纯白背景，横版构图，三视图（正面 / 左侧 / 背面全身站姿）。30 岁上下东亚男性，中等身材略壮实，短发，面相憨直。素色快递工装短袖配工装裤，腰挂扫描枪，胸前挂无字工牌，无任何品牌标识。中性棚拍光，无遮挡，完整人物不裁切。',
    promptRevision: 0,
  },
  {
    id: X.hoodie, kind: 'costume',
    name: '宽松连帽卫衣', aliases: ['连帽卫衣', '卫衣'],
    imagePrompt: '纯白背景，米灰色超宽松连帽卫衣平铺 / 挂拍，帽子自然垂落，棉质柔软有褶皱，正背两面，无人物。',
    promptRevision: 0,
  },
  {
    id: X.living, kind: 'location', timeOfDay: '日 / 内',
    name: '客厅', aliases: ['房间'],
    imagePrompt: '现代都市公寓客厅，横版空镜。米色布艺三人沙发，散落抱枕，冷白 4000K，写实电影感，35mm 广角，无人物。',
    promptRevision: 0,
  },
  {
    id: X.entry, kind: 'location', timeOfDay: '日 / 内',
    name: '玄关', aliases: ['门口'],
    imagePrompt: '公寓入户玄关，横版空镜。木质鞋柜、防盗门、门上猫眼，暖白顶灯偏暗，写实电影感，35mm，无人物。',
    promptRevision: 0,
  },
  {
    id: X.parcel, kind: 'prop',
    name: '退货包裹', aliases: ['包裹', '退货件'],
    imagePrompt: '纯白背景产品图，浅棕色瓦楞纸箱，缠透明胶带，正面贴一张白色空白面单，45° 俯视，写实，无品牌标识。',
    promptRevision: 0,
  },
  // 着装角色：苏可穿卫衣。快递员没有独立服装 → 镜头里以角色兜底挂载，页面出「未指定着装」告警。
  {
    id: X.lookSuke, kind: 'look',
    name: '苏可 · 宽松连帽卫衣',
    characterId: X.suke, costumeIds: [X.hoodie],
    imagePrompt: '【着装融合】苏可 · 宽松连帽卫衣：把苏可素模与米灰连帽卫衣融合成穿好衣服的定妆图。',
    promptRevision: 0,
  } as Look,
]

// mm()：与 seed 的 m() 同构 —— 角色 + 其服装 → look；游离服装并入 look；只有角色没服装 → 角色兜底。
const kindOf: Record<string, AssetKind> = Object.fromEntries(altAssets.map((a) => [a.id, a.kind]))
const LOOK_BY_CHAR: Record<string, Look> = {}
for (const a of altAssets) if (a.kind === 'look') LOOK_BY_CHAR[a.characterId] = a
const mm = (...ids: string[]): MountRef[] => {
  const present = new Set(ids)
  const out: MountRef[] = []
  const seen = new Set<string>()
  const push = (kind: MountableKind, assetId: string) => {
    if (seen.has(assetId)) return
    seen.add(assetId)
    out.push({ kind, assetId })
  }
  for (const id of ids) {
    const kind = kindOf[id]
    if (kind === 'costume') continue
    if (kind === 'character') {
      const look = LOOK_BY_CHAR[id]
      if (look && look.costumeIds.some((cid) => present.has(cid))) push('look', look.id)
      else push('character', id)
      continue
    }
    push(kind as MountableKind, id)
  }
  return out
}

// 每条镜从 PROMPTS 拉 ep2 对应那条的 image / video（promptKey），其余字段本地给。
interface AltShotSeed {
  promptKey: string
  title: string
  duration: number
  shotSize: string
  lens: string
  lighting: string
  cameraMove: string
  dialogue: string
  sfx: string
  mounts: MountRef[]
  sourceQuote: string
}

const altS1Seeds: AltShotSeed[] = [
  {
    promptKey: 'e2s1_sh1', title: '瘫软沙发 · 长出一口气', duration: 4,
    shotSize: '中景', lens: '35mm f/2.8', lighting: '自然光偏冷', cameraMove: '慢推', dialogue: '无', sfx: '一声瘫倒的叹气',
    mounts: mm(X.suke, X.hoodie, X.living), sourceQuote: '（退货风波）苏可瘫软在沙发上，长出一口气。',
  },
  {
    promptKey: 'e2s1_sh2', title: '手机提醒 · 快递上门取件', duration: 4,
    shotSize: '特写', lens: '85mm f/2.0', lighting: '屏幕冷光', cameraMove: 'Rack Focus', dialogue: '无', sfx: '短信提示音',
    mounts: mm(X.suke, X.hoodie, X.living), sourceQuote: '（退货风波）手机弹出快递上门取件提醒。',
  },
  {
    promptKey: 'e2s1_sh3', title: '生无可恋 · 爬起走向门口', duration: 4,
    shotSize: '全景', lens: '24mm f/4.0', lighting: '自然光偏冷', cameraMove: '跟随', dialogue: '无', sfx: '拖沓的脚步声',
    mounts: mm(X.suke, X.hoodie, X.living), sourceQuote: '（退货风波）她不情愿地爬起身走向门口。',
  },
]

const altS2Seeds: AltShotSeed[] = [
  {
    promptKey: 'e2s2_sh1', title: '快递员敲门 · 门外催促', duration: 4,
    shotSize: '中景', lens: '35mm f/2.8', lighting: '玄关暖白偏暗', cameraMove: '定镜', dialogue: '快递员（门外喊声）', sfx: '急促的敲门声',
    mounts: mm(X.suke, X.courier, X.hoodie, X.entry), sourceQuote: '（退货风波）快递员：「取件的！退货件在家吗？」',
  },
  {
    promptKey: 'e2s2_sh2', title: '递出包裹 · 飞速关门', duration: 4,
    shotSize: '全景', lens: '24mm f/4.0', lighting: '玄关暖白偏暗', cameraMove: '手持', dialogue: '无', sfx: '门轴与关门声',
    mounts: mm(X.suke, X.courier, X.hoodie, X.entry, X.parcel), sourceQuote: '（退货风波）她从门缝塞出包裹，飞速关门。',
  },
]

function buildAltScene(
  sceneId: string, no: number, name: string, location: string, timeOfDay: string,
  rawText: string, track: Scene['track'], seeds: AltShotSeed[], shotStore: Record<string, Shot>,
): Scene {
  const shotIds = seeds.map((s, i) => {
    const id = `${sceneId}_sh${i + 1}`
    const { promptKey, ...rest } = s
    shotStore[id] = {
      ...rest, id, sceneId, no: i + 1,
      imagePrompt: PROMPTS[promptKey]?.image ?? '',
      videoPrompt: PROMPTS[promptKey]?.video ?? '',
    }
    return id
  })
  return { id: sceneId, episodeId: 'alt_e1', no, name, location, timeOfDay, rawText, shotIds, density: 'standard', track }
}

const altShots: Record<string, Shot> = {}
const altScene1 = buildAltScene(
  'alt_s1', 1, '客厅沙发', '客厅', '当天下午',
  '当天下午 · 客厅沙发\n\n苏可瘫软在沙发里。手机再次震动，是快递上门取件的提醒。她万般不情愿地爬起身。',
  { mood: '松弛 → 又被打扰的无奈。', bgm: '慵懒的午后小调，被提醒音打断。' },
  altS1Seeds, altShots,
)
const altScene2 = buildAltScene(
  'alt_s2', 2, '玄关取件', '玄关', '紧接上场',
  '紧接上场 · 玄关\n\n快递员在门外催促取件。苏可从门缝把退货包裹塞出去，飞速关门，全程社恐不露脸。',
  { mood: '社恐式的应付，速战速决。', bgm: '带点滑稽的紧张短音。' },
  altS2Seeds, altShots,
)

const altEpisode: Episode = {
  id: 'alt_e1', no: 1, title: '退货风波', sceneIds: ['alt_s1', 'alt_s2'],
  rawText: buildEpisodeRawText([altScene1, altScene2]),
  wordCount: 2400,
}

/** 覆盖导入的新剧本载荷。title 只用于 toast，不写回被保留的 project.title。 */
export const altScriptPayload: ScriptPayload = {
  title: '退货风波',
  episodes: [altEpisode],
  scenes: { [altScene1.id]: altScene1, [altScene2.id]: altScene2 },
  shots: altShots,
  assets: Object.fromEntries(altAssets.map((a) => [a.id, a])),
}
