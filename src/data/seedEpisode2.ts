// 第 2 集：专供「追加集」演示，初始不加载。
// 关键点：既含老角色「苏可」（应被去重复用旧 id），又含新增资产（应新建）。
// 新集该带什么资产就带什么 —— 净增数量由内容决定，不是一个写死的常数。
// 本集新增：角色「快递员」+ 道具「退货包裹」。
import type { Episode, Scene, Shot, Asset, Look, MountRef } from './types'
import { A, m } from './seed'
import { PROMPTS } from './prompts'

// 第 2 集内部临时 id：苏可用临时 id，交给 appendEpisode 按名称去重后重指向旧 id。
const T = {
  suke: 'c_suke__ep2', // 老角色（临时 id，会被 appendEpisode 重定向到 c_suke）
  courier: 'c_courier', // 新角色
  parcel: 'p_parcel', // 新道具：这一集才出现的退货包裹
  courierCostume: 'cos_courier', // 新服装：快递员工装，与角色素模分开生成再融合
  courierLook: 'lk_courier_costume', // 新着装角色：快递员穿工装的定妆图
} as const

// 第 2 集带来的资产（其余场景 / 道具 / 服装直接复用第 1 集的既有 id）。
// 追加集不设「只能新增几个」的上限：这一集出现了新道具就建新道具。
export const ep2Assets: Asset[] = [
  {
    id: T.suke, kind: 'character', role: 'lead',
    name: '苏可', // 与第 1 集同名 → 归一化后命中，复用旧 id
    imagePrompt: '（与第 1 集同一角色，复用既有设定板）',
    promptRevision: 0,
  },
  {
    id: T.courier, kind: 'character', role: 'extra',
    name: '快递员', aliases: ['快递'],
    imagePrompt: `【生成规格】角色素模基础视觉资产设定板 · 纯白无缝背景 · 16:9 横版构图 · 三视图并排（正面 / 左侧 90° 正侧 / 背面全身站姿），三视图人物等高等比、脚底落在同一条水平线上 · 人物占画面高度 85%，头顶与脚尖各留约 5% 余量 · 相机为等效 85mm 中长焦、平视、无透视畸变 · 无投影落到背景 · 完整人物不裁切。
【体型】30 岁上下东亚男性，身高约 175cm，中等身材略壮实：肩宽且厚，斜方肌发达，胸廓宽，腰腹有一点自然的中年发福但不明显，小臂结实、前臂肌肉线条清晰，大腿粗壮。这是「常年搬箱子搬出来的」实用型体型，不是健身房的雕刻感。站姿踏实，双脚略分开与肩同宽或更宽，重心居中压实，双手自然垂在身侧。
【面部】方圆脸，颧弓宽，面颊有肉，下颌角明显但被脂肪柔化，下巴短而方；眼裂偏小，眼神直接不闪躲，眼袋轻微；眉毛短而粗、眉形平；鼻梁不高，鼻头宽厚，鼻翼外扩；嘴唇偏厚，唇形宽，嘴角平直。面相憨直、不带心机，但眉眼之间透着赶时间的急躁。眼神平视镜头。
【发型】黑色短发，两侧与后颈推短，头顶略长约 3cm，自然分向一侧但不刻意打理；发质硬、发根立，略显毛躁，发际线略高。
【肤色气质】东亚中性偏黄、带一点风吹日晒的肤色，颈后与手臂比躯干略深；皮肤保留真实的毛孔、细纹与轻微油光，不磨皮；下巴有淡淡的胡茬阴影（未刮净）。整体气质是踏实的、话不多的、催单时会提高音量的基层劳动者。
【手部】双手自然垂在身侧，手指舒展；手掌宽厚，指节粗大，掌心与指根有明显的厚茧，指甲短、边缘有一点毛糙；无饰品。每只手恰好五指、结构正确 —— 后续「敲门 / 接过包裹」的镜头以此为融合依据。
【基础着装】仅穿中性灰的贴身短袖上衣与同色系贴身长裤，面料为无光泽的纯棉针织，版型贴合但不勒，用于清晰交代肩背厚度与四肢围度。本设定板是素模，戏服与配件一律由服装资产单独生成后再融合，此处不出现任何戏服。
【三视图要求】三个视图必须是同一个人在同一时刻的三个角度，不是三张各自生成的图：身高、头身比、发型、肤色、体型、基础着装必须完全一致。正面视图眼神平视镜头、双肩水平；正侧视图鼻尖朝向画面左侧、耳廓完整可见、能读出厚实的肩背与略前探的颈部；背面视图斜方肌与肩背轮廓宽厚、双肩水平。三视图之间留出均匀间距，互不遮挡、互不重叠。
【光线】中性棚拍柔光。主光为正面偏上 45° 的大面积柔光箱，两侧各一盏等强度补光；色温 5500K，显色准确；全场无强阴影、无投影落到背景上；白背景纯净不发灰。
【质感】高细节写实渲染，真人摄影质感；皮肤的油光与胡茬、硬发质、针织面料三种质感层次分明；轻微自然锐度，无过度锐化。
【禁止】画面内字幕、水印、logo、色卡、标注文字；快递工装、扫描枪、工牌、腰包等任何戏服与配件；第二个人物入画；三视图之间人物比例、发型或五官不一致；手指数量错误或肢体变形；把人物做得过于凶恶（像打手）或过于喜剧化（像小品演员）；肌肉过于夸张；背景出现地面、阴影或渐变。`,
    promptRevision: 0,
  },
  {
    id: T.courierCostume, kind: 'costume',
    name: '快递工装', aliases: ['快递服'],
    imagePrompt: `【生成规格】服装资产平铺图 · 纯白无缝背景 · 16:9 横版构图 · 上下两排：上排为工装短袖正面 / 背面平铺（左右并排），下排为工装长裤、手持条码扫描枪与空白工牌（从左到右） · 顶部垂直俯拍、镜头轴线垂直于台面、无透视畸变 · 无人物、无人台、无模特、无衣架。
【款式版型】素色快递工装短袖：翻领 POLO 式领口、三粒扣半开门襟、宽松直筒版型、胸围宽松量约 16cm、袖口平直无罗纹、衣长到胯、下摆平直开衩。工装长裤：中腰、直筒、裤长到脚踝、腰头有六个裤袢，两侧各有一个带袋盖的大立体贴袋，膝盖处有一道横向拼接线与轻微的立体余量。手持条码扫描枪：枪形握把式，长约 18cm，配一枚黑色腰挂皮扣。工牌：长方形，约 9×6cm，配一根黑色织带挂绳。
【颜色材质】主体为中性哑光藏青蓝（接近 Pantone 539C），领口与袖口各有一道宽 0.8cm 的浅灰细条。面料是耐磨的涤棉混纺工装布（涤 65% / 棉 35%），表面有细密的平织纹理，硬挺、不垂坠、完全不反光。扫描枪为深灰工程塑料，表面为细磨砂、握把处有防滑纹，顶端有一小块深红色的取景窗玻璃。工牌为白色亚克力，边角圆润，表面有一层薄的哑光。
【工艺细节】门襟、领座、袋口、裤侧缝均为深灰双针明线，针距密实；肩部有一道横向育克拼接，宽约 8cm；裤侧贴袋有袋盖与魔术贴闭合；纽扣为哑光深灰树脂扣。工牌表面与扫描枪机身一律为纯粹空白 —— 无姓名、无编号、无条码、无二维码、无任何公司标识与文字。
【配件】手持条码扫描枪一把（含腰挂皮扣）、空白工牌一枚（含挂绳）；不含鞋、帽、腰包。
【状态】平铺自然而非熨烫展平：短袖两袖沿身侧摊开、袖口各有一道轻微的翻折，领口摆正但领尖略微上翘（长期被挂绳压过）；长裤裤腿平行摊开、膝盖处有明显的横向折痕与轻微的膝部鼓包。面料有真实的使用痕迹 —— 袖口与裤脚边缘细微磨白、袋盖边缘起毛、领口内侧有一圈很淡的深色。扫描枪握把处有使用留下的浅浅光亮，工牌表面有几道细划痕。这是一套天天穿在身上的工装，不是崭新样品。
【光线】中性棚拍柔光。顶部一盏大面积柔光箱作为主光，四周补光均匀；色温 5500K，显色准确，藏青不得偏紫或偏黑；保留工装布的平织纹理与深灰明线的层次；扫描枪的磨砂塑料有柔和的带状高光、不刺眼；背景纯白不发灰、无投影。
【质感】高细节写实产品摄影质感；涤棉工装布的硬挺织纹、工程塑料的磨砂、亚克力的哑光三种肌理清晰可辨；轻微自然锐度，无过度锐化。
【禁止】画面内字幕、水印；任何快递公司的名称、logo、配色标识、条码、二维码、姓名、工号；工牌或扫描枪上出现任何文字与图形；人物、人台、模特、假人、衣架；把工装做成军装、保安制服或工程服；反光面料、皮革感；扫描枪做成玩具感或科幻武器感；崭新平整的电商商品图感；配件缺失或部分出画。`,
    promptRevision: 0,
  },
  {
    id: T.parcel, kind: 'prop',
    name: '退货包裹', aliases: ['包裹', '退货件'],
    imagePrompt: `【生成规格】道具产品图 · 纯白无缝背景 · 16:9 横版构图 · 主图为 45° 俯视（占画面 55%），右侧附一张正面平视小图（占画面 20%，交代箱体比例与面单位置） · 等效 85mm、无透视畸变 · 极淡的接触影。
【形态】中等大小的长方体瓦楞纸箱，约 35×25×20cm。箱型整体规整，但因为是二次打包而略有变形：左前方一个箱角被压得有点塌陷，顶盖的两片折页没有完全对齐、中间留出一道约 5mm 的错缝，箱体侧面有一处浅浅的凹陷。
【材质颜色】浅棕色单层瓦楞纸（B 楞），表面能看到粗糙的纸浆纤维、细微的斑点与浅浅的瓦楞压痕；完全哑光、不反光；箱体边角与压塌处露出一点白色的瓦楞芯与起毛的纸边。
【细节】箱盖接缝与四条箱棱缠着透明 OPP 胶带，宽约 5cm：胶带缠得不太整齐 —— 有明显的褶皱、几处气泡与错位，一条边的末端翘起一小截约 3cm 未贴牢；胶带在光下有半透明的塑料反光，能透出下方的瓦楞纹理。箱面正中偏上贴着一张白色长方形面单（约 10×15cm），面单上完全空白 —— 没有任何文字、条码、二维码、姓名、地址、电话或公司标识，只有纸张本身的白与四边的边框压痕；面单一角略微翘起。箱体另一侧有一处此前撕过标签留下的浅色胶痕与残胶。
【状态】一看就是「拆开又原样封回去」的退货件：胶带是二次缠的、走向与原来的封箱线不完全重合；箱面有轻微的压痕、灰印与一处凹陷；纸箱边缘起毛。不是崭新挺括的商品包装。
【辅视图】右侧正面平视小图交代：箱体的正面比例、面单在箱面上的位置与大小、以及被压塌的那个箱角。小图与主图为同一个箱子、同一光线条件。
【光线】中性棚拍柔光。主光为顶部偏右 45° 的柔光箱，左侧一盏低强度补光；额外从画面左侧打一盏低角度擦光，突出瓦楞纸的纤维质感、压痕与胶带的褶皱起伏；色温 5500K；透明胶带的反光收成柔和的带状，不刺眼；背景纯白不发灰、无投影。
【质感】高细节写实产品摄影质感；瓦楞纸的粗糙纤维、OPP 胶带的半透明塑料光泽、面单纸的哑光平整三种质感层次分明；轻微自然锐度，无过度锐化。
【禁止】画面内字幕、水印；任何快递公司的名称、logo、配色标识、条码、二维码、姓名、地址、电话；面单上出现任何文字或图形（哪怕是模糊的乱码）；纸箱做成崭新挺括、边角锐利的商品包装；胶带缠得整齐美观；箱子做成礼盒、彩印箱或塑料周转箱；人物、手部入画。`,
    promptRevision: 0,
  },
  // 着装角色：快递员穿工装。绑定关系永久只读（决策 1b）。imagePrompt 为 demo 占位。
  {
    id: T.courierLook, kind: 'look',
    name: '快递员 · 快递工装',
    characterId: T.courier, costumeIds: [T.courierCostume],
    imagePrompt: '【着装融合】快递员 · 快递工装：把快递员素模与藏青快递工装融合成穿好衣服的定妆图，人物一致性以角色素模为准、服装以工装资产为准。',
    promptRevision: 0,
  } as Look,
]

/** 第 2 集自带的新资产，需手工构造 MountRef —— seed 的 m() 只认得第 1 集的资产。
 *  服装不参与挂载（决策 3b），快递员挂的是着装角色 look，不是「角色 + 服装」两条。 */
const parcelMount: MountRef = { kind: 'prop', assetId: T.parcel }
const courierLookMount: MountRef = { kind: 'look', assetId: T.courierLook }

type ShotSeed = Omit<Shot, 'id' | 'sceneId' | 'no'>

const ep2s1Shots: ShotSeed[] = [
  {
    title: '挂断视频 · 瘫软在沙发', duration: 4,
    shotSize: '中景', lens: '35mm f/2.8', lighting: '自然光偏冷',
    imagePrompt: '中景。苏可挂断和妈妈的视频后，整个人瘫软陷进客厅沙发，长出一口气。',
    cameraMove: '慢推', dialogue: '无', sfx: '一声瘫倒的叹气',
    videoPrompt: '{0-4s} 缓推。苏可瘫软陷进沙发，劫后余生。',
    mounts: m(A.suke, A.hoodie, A.living),
    sourceQuote: '（第 2 集续写）挂断视频后，苏可瘫软在沙发上。',
  },
  {
    title: '手机再震 · 退货提醒', duration: 4,
    shotSize: '特写', lens: '85mm f/2.0', lighting: '屏幕冷光',
    imagePrompt: '特写。手机屏幕弹出「快递员即将上门取件」的提醒。',
    cameraMove: 'Rack Focus', dialogue: '无', sfx: '短信提示音',
    videoPrompt: '{0-2s} 屏幕亮起提醒。{2-4s} Rack Focus 到苏可无语的脸。',
    mounts: m(A.suke, A.hoodie, A.living, A.phone),
    sourceQuote: '（第 2 集续写）手机弹出快递上门提醒。',
  },
  {
    title: '生无可恋 · 爬起身', duration: 4,
    shotSize: '全景', lens: '24mm f/4.0', lighting: '自然光偏冷',
    imagePrompt: '全景。苏可万般不情愿地从沙发上爬起，拖着步子走向门口。',
    cameraMove: '跟随', dialogue: '无', sfx: '拖沓的脚步声',
    videoPrompt: '{0-4s} 跟随苏可拖着步子走向门口。',
    mounts: m(A.suke, A.hoodie, A.living),
    sourceQuote: '（第 2 集续写）她不情愿地爬起身走向门口。',
  },
]

const ep2s2Shots: ShotSeed[] = [
  {
    title: '快递员敲门 · 门外催促', duration: 4,
    shotSize: '中景', lens: '35mm f/2.8', lighting: '玄关暖白偏暗',
    imagePrompt: '中景。玄关门被敲响，苏可迟疑地站在门后。',
    cameraMove: '定镜', dialogue: '快递员（门外喊声）', sfx: '急促的敲门声',
    videoPrompt: '{0-4s} 定镜对门。画外音（快递员）：「取件的！退货件在家吗？下楼我可就走了啊！」',
    mounts: [...m(A.suke, A.hoodie, A.entry), courierLookMount],
    sourceQuote: '（第 2 集续写）快递员：「取件的！退货件在家吗？」',
  },
  {
    title: '递出包裹 · 飞速关门', duration: 4,
    shotSize: '全景', lens: '24mm f/4.0', lighting: '玄关暖白偏暗',
    imagePrompt: '全景。苏可从门缝把退货包裹塞出去，飞速关门，全程不露正脸。',
    cameraMove: '手持', dialogue: '无', sfx: '门轴与关门声',
    videoPrompt: '{0-2s} 门缝递出包裹。{2-4s} 飞速关门。',
    mounts: [...m(A.suke, A.hoodie, A.entry), courierLookMount, parcelMount],
    sourceQuote: '（第 2 集续写）她从门缝塞出包裹，飞速关门。',
  },
]

function buildScene(
  sceneId: string, no: number, name: string, location: string, timeOfDay: string,
  rawText: string, track: Scene['track'], seeds: ShotSeed[], shotStore: Record<string, Shot>,
): Scene {
  const shotIds = seeds.map((s, i) => {
    const id = `${sceneId}_sh${i + 1}`
    shotStore[id] = {
      ...s, id, sceneId, no: i + 1,
      imagePrompt: PROMPTS[id]?.image ?? s.imagePrompt,
      videoPrompt: PROMPTS[id]?.video ?? s.videoPrompt,
    }
    return id
  })
  return { id: sceneId, episodeId: 'e2', no, name, location, timeOfDay, rawText, shotIds, density: 'standard', track }
}

const ep2Shots: Record<string, Shot> = {}
const ep2s1 = buildScene(
  'e2s1', 1, '客厅沙发', '客厅', '当天下午',
  '当天下午 · 客厅沙发\n\n挂断妈妈的视频后，苏可瘫软在沙发里。手机再次震动，是快递上门取件的提醒。她万般不情愿地爬起身。',
  { mood: '劫后余生的松弛 → 又被打扰的无奈。', bgm: '慵懒的午后小调，被提醒音打断。' },
  ep2s1Shots, ep2Shots,
)
const ep2s2 = buildScene(
  'e2s2', 2, '玄关取件', '玄关', '紧接上场',
  '紧接上场 · 玄关\n\n快递员在门外催促取件。苏可从门缝把退货包裹塞出去，飞速关门，全程社恐不露脸。',
  { mood: '社恐式的应付，速战速决。', bgm: '带点滑稽的紧张短音。' },
  ep2s2Shots, ep2Shots,
)

export const ep2Episode: Episode = {
  id: 'e2', no: 2, title: '视频求生', sceneIds: ['e2s1', 'e2s2'],
}

export const ep2Scenes: Record<string, Scene> = {
  [ep2s1.id]: ep2s1,
  [ep2s2.id]: ep2s2,
}

export const ep2ShotStore: Record<string, Shot> = ep2Shots

// 打包成 appendEpisode 的输入。
export interface EpisodePayload {
  episode: Episode
  scenes: Record<string, Scene>
  shots: Record<string, Shot>
  assets: Asset[]
}

export const episode2Payload: EpisodePayload = {
  episode: ep2Episode,
  scenes: ep2Scenes,
  shots: ep2ShotStore,
  assets: ep2Assets,
}
