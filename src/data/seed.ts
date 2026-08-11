// 第 1 集：《最后的尊严》3 场 25 镜 + 全部资产。
// 内容全部取材自剧本原文，不用 lorem —— 原型的说服力全在这。
import type { Project, Scene, Shot, Asset, MountRef } from './types'
import { PROMPTS } from './prompts'

// ── 资产 id（全剧唯一，供挂载引用）──
export const A = {
  suke: 'c_suke',
  mom: 'c_mom',
  delivery: 'c_delivery',
  hoodie: 'cos_hoodie',
  living: 'loc_living',
  entry: 'loc_entry',
  corridor: 'loc_corridor',
  table: 'loc_table',
  phone: 'p_phone',
  pillow: 'p_pillow',
  bear: 'p_bear',
  bag: 'p_bag',
  malatang: 'p_malatang',
  napkin: 'p_napkin',
} as const

const assetList: Asset[] = [
  // ── 角色 ──
  {
    id: A.suke, kind: 'character', role: 'lead',
    name: '苏可',
    description: '24 岁，资深宅家爱好者 / 资深吃货。为逃避社交和健身教练的电话不遗余力，但在美食面前又充满行动力。',
    imagePrompt: '一张高精度、干净极简的角色基础视觉资产设定板。纯白背景，横版构图，三视图（正面 / 左侧 / 背面全身站姿）。24 岁东亚女性，精致甜美初恋脸，黑色中长发微卷。中性棚拍光，无遮挡，完整人物不裁切。',
    appearances: [{ episodeNo: 1, sceneNo: 1 }, { episodeNo: 1, sceneNo: 2 }, { episodeNo: 1, sceneNo: 3 }],
  },
  {
    id: A.mom, kind: 'character', role: 'support',
    name: '妈妈',
    description: '苏可的母亲，未出镜，仅通过微信视频通话的声音存在，嗅觉灵敏、掐点精准。',
    imagePrompt: '一张高精度、干净极简的角色基础视觉资产设定板。纯白背景，横版构图，三视图（正面 / 左侧 / 背面全身站姿）。50 岁上下东亚女性，圆脸，短卷发微烫、鬓角有少量白发，眉眼精明和善、笑起来有细纹。家常针织开衫配深色直筒长裤，居家布鞋。中性棚拍光，无遮挡，完整人物不裁切。',
    appearances: [{ episodeNo: 1, sceneNo: 3 }],
  },
  {
    id: A.delivery, kind: 'character', role: 'extra',
    name: '外卖员',
    description: '男，约 25 岁。负责送餐，未在画面中露面，仅在门外大声喊话。',
    imagePrompt: '一张高精度、干净极简的角色基础视觉资产设定板。纯白背景，横版构图，三视图（正面 / 左侧 / 背面全身站姿）。25 岁上下东亚男性，瘦高，短寸头，皮肤偏黑，神情匆忙不耐。骑手工装冲锋衣配束脚长裤，斜挎单肩包，头盔提在手上（不戴），无任何品牌标识与文字。中性棚拍光，无遮挡，完整人物不裁切。',
    appearances: [{ episodeNo: 1, sceneNo: 1 }],
  },
  // ── 服装（挂在角色下）──
  {
    id: A.hoodie, kind: 'costume', characterId: A.suke,
    name: '宽松连帽卫衣',
    description: '超级宽松的连帽卫衣，帽子扣在头上，居家慵懒感，米灰色。',
    imagePrompt: '纯白背景，米灰色超宽松连帽卫衣平铺 / 挂拍，帽子自然垂落，棉质柔软有褶皱，正背两面，无人物。',
    appearances: [{ episodeNo: 1, sceneNo: 1 }, { episodeNo: 1, sceneNo: 2 }, { episodeNo: 1, sceneNo: 3 }],
  },
  // ── 场景（按 空间 × 时段 拆）──
  {
    id: A.living, kind: 'location', timeOfDay: '日 / 内',
    name: '客厅',
    description: '乱中有序的客厅，窗帘紧闭。米色布艺沙发居中，茶几堆着零食包装。自然光从窗帘缝隙渗入，整体偏冷调。',
    imagePrompt: '现代都市公寓客厅，横版空镜。米色布艺三人沙发，散落抱枕，茶几堆放零食与外卖盒。窗帘紧闭仅缝隙漏光，冷白 4000K，高明暗对比，写实电影感，35mm 广角，无人物。',
    appearances: [{ episodeNo: 1, sceneNo: 1 }],
  },
  {
    id: A.entry, kind: 'location', timeOfDay: '日 / 内',
    name: '玄关',
    description: '客厅通往大门的玄关，鞋柜、猫眼、门锁，光线比客厅更暗。',
    imagePrompt: '公寓入户玄关，横版空镜。木质鞋柜、防盗门、门上猫眼，暖白顶灯偏暗，写实电影感，35mm，无人物。',
    appearances: [{ episodeNo: 1, sceneNo: 2 }],
  },
  {
    id: A.corridor, kind: 'location', timeOfDay: '日 / 外',
    name: '公寓走廊',
    description: '猫眼视角外的公共走廊，空无一人，地上放着一个冒热气的外卖袋。',
    imagePrompt: '公寓楼公共走廊，鱼眼猫眼视角轻微畸变，空无一人，地面放一个冒热气的外卖打包袋，冷调日光，写实。',
    appearances: [{ episodeNo: 1, sceneNo: 2 }],
  },
  {
    id: A.table, kind: 'location', timeOfDay: '日 / 内',
    name: '餐桌区',
    description: '客厅一角的餐桌，单人位，铺开餐巾纸和一次性筷子，仪式感十足。',
    imagePrompt: '公寓客厅一角单人餐桌，横版空镜。木质桌面，窗光偏冷，写实电影感，35mm，无人物。',
    appearances: [{ episodeNo: 1, sceneNo: 3 }],
  },
  // ── 道具（只提取会被镜头单独交代的物件）──
  {
    id: A.phone, kind: 'prop',
    name: '智能手机',
    description: '黑色直板手机，屏幕常亮，先后显示来电界面与微信视频邀请。',
    imagePrompt: '纯白背景产品图，黑色直板智能手机，屏幕点亮显示来电界面，正面平视，无反光干扰。',
    appearances: [{ episodeNo: 1, sceneNo: 1 }, { episodeNo: 1, sceneNo: 3 }],
  },
  {
    id: A.pillow, kind: 'prop',
    name: '沙发抱枕',
    description: '米色棉麻方形抱枕，柔软有褶皱，苏可把手机踢到它下面。',
    imagePrompt: '纯白背景，米色棉麻方形抱枕，柔软质感，自然褶皱，45° 俯视。',
    appearances: [{ episodeNo: 1, sceneNo: 1 }],
  },
  {
    id: A.bear, kind: 'prop',
    name: '巨大毛绒熊',
    description: '米棕色，半人高，坐姿，苏可躲在它后面。',
    imagePrompt: '纯白背景，米棕色半人高毛绒熊，坐姿，正面，无阴影。',
    appearances: [{ episodeNo: 1, sceneNo: 1 }],
  },
  {
    id: A.bag, kind: 'prop',
    name: '外卖打包袋',
    description: '冒着热气的塑料打包袋，尾号 0617，装着豪华麻辣烫。',
    imagePrompt: '纯白背景，白色塑料外卖打包袋，扎口冒热气，贴单，写实产品图。',
    appearances: [{ episodeNo: 1, sceneNo: 2 }, { episodeNo: 1, sceneNo: 3 }],
  },
  {
    id: A.malatang, kind: 'prop',
    name: '豪华麻辣烫',
    description: '一碗冒着红油热气的加辣加臭加炸蛋豪华麻辣烫，鱼丸裹满汤汁。',
    imagePrompt: '纯白背景，一碗红油麻辣烫俯视图，鱼丸、蔬菜、炸蛋，热气升腾，写实美食图，高饱和。',
    appearances: [{ episodeNo: 1, sceneNo: 3 }],
  },
  {
    id: A.napkin, kind: 'prop',
    name: '餐巾纸与筷子',
    description: '一次性筷子和铺开的餐巾纸，仪式感的一部分。',
    imagePrompt: '纯白背景，一次性木筷与白色餐巾纸，简洁摆放。',
    appearances: [{ episodeNo: 1, sceneNo: 3 }],
  },
]

// 挂载简写：把 assetId 列表转成 MountRef[]，kind 从 assetList 反查。
const kindOf: Record<string, MountRef['kind']> = Object.fromEntries(
  assetList.map((a) => [a.id, a.kind]),
)
export const m = (...ids: string[]): MountRef[] =>
  ids.map((assetId) => ({ kind: kindOf[assetId]!, assetId }))

type ShotSeed = Omit<Shot, 'id' | 'sceneId' | 'no'>

// ══ 第 1 场 · 客厅沙发 · 8 镜 · 32s ══
const scene1Shots: ShotSeed[] = [
  {
    title: '致命来电 · 手机屏幕特写', duration: 3,
    shotSize: '特写', lens: '100mm f/2.8 定焦', lighting: '冷白 4000K · 高对比',
    imagePrompt: '极近微距特写。手机屏幕充满画面，高亮刺眼，来电显示「健身教练-王（15）」清晰可辨。背景为客厅沙发织物，浅景深虚化。苏可蜷缩在沙发角落，仅露出部分轮廓。',
    cameraMove: '慢推 → Rack Focus', dialogue: '无', sfx: '高频震动嗡嗡声',
    videoPrompt: '{0-2s} 镜头缓慢推近手机屏幕，屏幕疯狂闪烁。{2-3s} 快速虚实转换，焦点从手机移到后景苏可脸上，面部被屏幕冷光照亮。【禁止】背景音乐、画面内字幕。',
    mounts: m(A.suke, A.hoodie, A.living, A.phone),
    sourceQuote: '特写镜头。苏可蜷缩在沙发里，手机屏幕疯狂闪烁。来电显示：「健身教练-王（15）」。',
  },
  {
    title: '脚趾拆弹 · 把手机踢进抱枕', duration: 4,
    shotSize: '中景', lens: '35mm f/4.0', lighting: '自然光偏冷',
    imagePrompt: '中景。苏可赤裸的脚趾用力将手机推入抱枕下方，动作夸张滑稽。客厅沙发全貌入画，米色布艺，散落抱枕。',
    cameraMove: '低角度跟随', dialogue: '苏可（碎碎念）', sfx: '织物下闷响',
    videoPrompt: '{0-2s} 低角度跟随脚趾动作。台词（碎碎念）：「看不见我……你看不见我……我已经在跑步机上猝死了……」{2-4s} 手机被埋入抱枕，闷声震动。',
    mounts: m(A.suke, A.hoodie, A.living, A.phone, A.pillow),
    sourceQuote: '苏可一脸「视死如归」，用脚趾把手机踢到了抱枕下面。手机在抱枕下闷声震动。',
  },
  {
    title: '抱枕下闷震 · 手机埋没', duration: 3,
    shotSize: '特写', lens: '85mm f/2.0', lighting: '自然光偏冷',
    imagePrompt: '特写。抱枕表面因手机震动而微微颤动，织物纹理清晰，旁边散落零食包装。',
    cameraMove: '定镜', dialogue: '无', sfx: '织物下沉闷的震动声',
    videoPrompt: '{0-3s} 定镜。抱枕随手机震动轻轻抖动，震动逐渐停止。【禁止】背景音乐。',
    mounts: m(A.suke, A.hoodie, A.living, A.phone, A.pillow),
    sourceQuote: '手机在抱枕下闷声震动。',
  },
  {
    title: '土拨鼠探头 · 确认安全', duration: 5,
    shotSize: '近景', lens: '50mm f/2.8', lighting: '柔和自然光',
    imagePrompt: '近景。苏可从抱枕堆中探出半个脑袋，眼神警惕左右张望，表情如释重负。',
    cameraMove: '定镜', dialogue: '无', sfx: '由震动骤停转为寂静',
    videoPrompt: '{0-3s} 定镜。震动停止，苏可像土拨鼠一样缓缓探头。{3-5s} 确认安全后长舒一口气。【禁止】背景音乐、画面内字幕。',
    mounts: m(A.suke, A.hoodie, A.living, A.pillow),
    sourceQuote: '震动停止。苏可像土拨鼠一样从抱枕里探出头，确认安全。',
  },
  {
    title: '如释重负 · 瘫倒闭眼', duration: 4,
    shotSize: '中景', lens: '35mm f/2.8', lighting: '柔和自然光',
    imagePrompt: '中景。苏可整个人如释重负地瘫倒在沙发上，四肢摊开，闭眼，嘴角带着劫后余生的满足。',
    cameraMove: '慢推', dialogue: '无', sfx: '一声长舒的叹气',
    videoPrompt: '{0-4s} 镜头极缓慢推近，苏可瘫倒后刚想闭眼享受安静。【禁止】背景音乐。',
    mounts: m(A.suke, A.hoodie, A.living),
    sourceQuote: '她如释重负地瘫倒，刚想闭眼。',
  },
  {
    title: '门铃惊魂 · 原地弹起', duration: 4,
    shotSize: '全景', lens: '24mm f/4.0', lighting: '自然光偏冷',
    imagePrompt: '全景。客厅全貌，苏可听到门铃后整个人从沙发上原地弹起，肢体僵直，表情如临大敌。',
    cameraMove: '手持', dialogue: '无', sfx: '「叮咚——」清脆刺耳的门铃声',
    videoPrompt: '{0-1s} 定镜安静。{1-2s} 「叮咚——」门铃声在安静房间里像防空警报。{2-4s} 手持微晃，苏可原地弹起。',
    mounts: m(A.suke, A.hoodie, A.living),
    sourceQuote: '「叮咚——」清脆的门铃声，在安静的房间里像防空警报。',
  },
  {
    title: '敏捷躲藏 · 钻到毛绒熊后', duration: 5,
    shotSize: '全景', lens: '24mm f/4.0', lighting: '自然光偏冷',
    imagePrompt: '全景。苏可动作敏捷地钻到半人高的巨大毛绒熊后面躲着，只露出一双警惕的眼睛。',
    cameraMove: '快速推近', dialogue: '无', sfx: '窸窸窣窣的躲藏声',
    videoPrompt: '{0-2s} 苏可如特工般扑向毛绒熊。{2-5s} 快速推近到熊后露出的半张脸，屏息。【禁止】背景音乐。',
    mounts: m(A.suke, A.hoodie, A.living, A.bear),
    sourceQuote: '苏可整个人原地弹起，动作敏捷地钻到了大毛绒熊后面躲着。',
  },
  {
    title: '外卖员喊话 · 门外画外音', duration: 4,
    shotSize: '中景', lens: '35mm f/2.8', lighting: '自然光偏冷',
    imagePrompt: '中景。紧闭的防盗门，门后隐约可见躲在毛绒熊后的苏可，画面重心在门与她之间的空气张力。',
    cameraMove: '定镜', dialogue: '外卖员（门外喊声）', sfx: '门外闷闷的喊话声',
    videoPrompt: '{0-4s} 定镜对着门。画外音（外卖员）：「尾号 0617 的外卖！加辣加臭加炸蛋的那份！没人在家我拿走退单了啊？」苏可在熊后表情剧变。',
    mounts: m(A.suke, A.hoodie, A.living),
    sourceQuote: '门外（外卖员喊声）：「尾号 0617 的外卖！加辣加臭加炸蛋的那份！没人在家我拿走退单了啊？」',
  },
]

// ══ 第 2 场 · 玄关 · 5 镜 · 20s ══
const scene2Shots: ShotSeed[] = [
  {
    title: '特工潜行 · 贴墙挪到门口', duration: 4,
    shotSize: '中景', lens: '35mm f/2.8', lighting: '玄关暖白偏暗',
    imagePrompt: '中景。苏可像特工一样贴着墙根小心翼翼挪向门口，身体压低，神情夸张警惕。',
    cameraMove: '跟随', dialogue: '无', sfx: '刻意放轻的脚步声',
    videoPrompt: '{0-4s} 镜头跟随苏可贴墙移动到门口，动作夸张滑稽。【禁止】背景音乐。',
    mounts: m(A.suke, A.hoodie, A.entry),
    sourceQuote: '镜头跟着苏可。她像特工一样，贴着墙根挪到门口，通过猫眼观察。',
  },
  {
    title: '猫眼观察 · 走廊空无一人', duration: 4,
    shotSize: '特写', lens: '猫眼鱼眼视角', lighting: '走廊冷调日光',
    imagePrompt: '猫眼鱼眼畸变视角。公共走廊空无一人，地上放着一个冒着热气的外卖打包袋。',
    cameraMove: '定镜', dialogue: '无', sfx: '走廊的空旷回声',
    videoPrompt: '{0-4s} 定镜，猫眼视角。走廊空无一人，热气从地上的外卖袋升起。',
    mounts: m(A.suke, A.hoodie, A.corridor, A.bag),
    sourceQuote: '走廊空无一人。地上放着一个冒着热气的袋子。',
  },
  {
    title: '开门捞外卖 · 迅速锁门', duration: 5,
    shotSize: '全景', lens: '24mm f/4.0', lighting: '玄关暖白偏暗',
    imagePrompt: '全景。苏可迅速开门，像抓猎物一样把外卖袋一把捞进屋内，随即回身猛地锁门。',
    cameraMove: '手持', dialogue: '无', sfx: '开门、抓取、门锁「咔哒」',
    videoPrompt: '{0-2s} 门缝拉开。{2-4s} 手快速捞起外卖袋。{4-5s} 回身锁门，一气呵成。',
    mounts: m(A.suke, A.hoodie, A.entry, A.bag),
    sourceQuote: '她迅速开门，像抓猎物一样把外卖捞进来，迅速锁门。',
  },
  {
    title: '背靠门板 · 大口喘气', duration: 4,
    shotSize: '近景', lens: '50mm f/2.0', lighting: '玄关暖白偏暗',
    imagePrompt: '近景。苏可背靠门板，怀里抱着外卖袋，大口喘气，像完成了一场惊心动魄的任务。',
    cameraMove: '慢推', dialogue: '无', sfx: '急促的喘气声',
    videoPrompt: '{0-4s} 镜头缓推。苏可背靠门板大喘气，肩膀起伏。',
    mounts: m(A.suke, A.hoodie, A.entry, A.bag),
    sourceQuote: '背靠门板大喘气。',
  },
  {
    title: '社交危机解除 · 狂喜低语', duration: 3,
    shotSize: '近景', lens: '50mm f/2.0', lighting: '玄关暖白偏暗',
    imagePrompt: '近景。苏可脸上绽放狂喜，眼神发亮，怀抱外卖袋如获至宝。',
    cameraMove: '定镜', dialogue: '苏可（狂喜）', sfx: '轻快的呼气',
    videoPrompt: '{0-3s} 定镜。台词（狂喜低语）：「呼……社交危机解除。现在是，我的时间。」',
    mounts: m(A.suke, A.hoodie, A.entry, A.bag),
    sourceQuote: '苏可（狂喜）：「呼……社交危机解除。现在是，我的时间。」',
  },
]

// ══ 第 3 场 · 餐桌 · 12 镜 · 51s ══
const scene3Shots: ShotSeed[] = [
  {
    title: '仪式感铺开 · 餐巾纸与筷子', duration: 4,
    shotSize: '中景', lens: '35mm f/2.8', lighting: '窗光偏冷',
    imagePrompt: '中景。苏可欢快地跑到餐桌前，仪式感极强地铺开餐巾纸，掰开一次性筷子。',
    cameraMove: '跟随', dialogue: '无', sfx: '筷子掰开的脆响',
    videoPrompt: '{0-2s} 跟随苏可跑到餐桌。{2-4s} 铺餐巾纸、掰筷子，动作充满仪式感。',
    mounts: m(A.suke, A.hoodie, A.table, A.napkin, A.bag),
    sourceQuote: '她欢快地跑到餐桌前，仪式感极强地铺开餐巾纸，掰开一次性筷子。',
  },
  {
    title: '拆开包装袋 · 红油溢出', duration: 4,
    shotSize: '特写', lens: '60mm f/2.8 微距', lighting: '暖光突出食物',
    imagePrompt: '特写。双手拆开外卖打包袋，红油麻辣烫露出，热气与香味仿佛溢出屏幕。',
    cameraMove: '慢推', dialogue: '无', sfx: '塑料袋摩擦、汤汁轻响',
    videoPrompt: '{0-4s} 缓推。拆开包装袋，红油的香味瞬间溢出屏幕，热气升腾。',
    mounts: m(A.suke, A.hoodie, A.table, A.bag, A.malatang),
    sourceQuote: '拆开包装袋——红油的香味瞬间溢出屏幕。',
  },
  {
    title: '夹起鱼丸 · 正要入口', duration: 4,
    shotSize: '极特写', lens: '100mm f/2.8 微距', lighting: '暖光突出食物',
    imagePrompt: '极特写。筷子夹起一颗裹满汤汁的鱼丸，红油欲滴，正要送往嘴边，背景为苏可期待的脸。',
    cameraMove: '慢推', dialogue: '无', sfx: '汤汁滴落声',
    videoPrompt: '{0-4s} 极缓推近鱼丸。她夹起裹满汤汁的鱼丸，正要往嘴里送。【禁止】背景音乐。',
    mounts: m(A.suke, A.hoodie, A.table, A.malatang),
    sourceQuote: '特写：她夹起一颗裹满汤汁的鱼丸，正要往嘴里送。',
  },
  {
    title: '手机再亮 · 微信视频邀请', duration: 4,
    shotSize: '特写', lens: '85mm f/2.0', lighting: '屏幕冷光',
    imagePrompt: '特写。桌上手机再次亮起，屏幕显示微信视频通话邀请界面，冷光照亮桌面一角。',
    cameraMove: 'Rack Focus', dialogue: '无', sfx: '微信视频呼叫铃声',
    videoPrompt: '{0-2s} 焦点在鱼丸。{2-4s} Rack Focus 转到亮起的手机，微信视频邀请。',
    mounts: m(A.suke, A.hoodie, A.table, A.phone),
    sourceQuote: '手机再次亮起。不是电话，是一条微信视频邀请。',
  },
  {
    title: '备注「亲妈」· 瞳孔一缩', duration: 3,
    shotSize: '特写', lens: '85mm f/2.0', lighting: '屏幕冷光',
    imagePrompt: '特写。手机屏幕备注「亲妈」清晰可见，画面切到苏可瞳孔一缩的眼睛特写。',
    cameraMove: '快速推近', dialogue: '无', sfx: '一声短促的心跳',
    videoPrompt: '{0-1.5s} 屏幕备注「亲妈」。{1.5-3s} 快切苏可瞳孔一缩。',
    mounts: m(A.suke, A.hoodie, A.table, A.phone),
    sourceQuote: '备注：「亲妈」。',
  },
  {
    title: '停顿 5 秒 · 鱼丸与手机之间', duration: 5,
    shotSize: '近景', lens: '50mm f/2.8', lighting: '窗光偏冷',
    imagePrompt: '近景。苏可看看手里的鱼丸，又看看响个不停的手机，纠结凝固，时间仿佛静止。',
    cameraMove: '定镜', dialogue: '无', sfx: '持续的视频呼叫铃声',
    videoPrompt: '{0-5s} 定镜。停顿 5 秒，苏可视线在鱼丸与手机之间来回，天人交战。【禁止】背景音乐。',
    mounts: m(A.suke, A.hoodie, A.table, A.malatang, A.phone),
    sourceQuote: '停顿 5 秒。苏可（看着鱼丸，又看着手机）。',
  },
  {
    title: '掐点吐槽 · 妈你真会掐点', duration: 4,
    shotSize: '近景', lens: '50mm f/2.8', lighting: '窗光偏冷',
    imagePrompt: '近景。苏可无奈地看着手机，嘴角抽动，低声吐槽。',
    cameraMove: '定镜', dialogue: '苏可', sfx: '视频呼叫铃声',
    videoPrompt: '{0-4s} 定镜。台词：「妈……你可真会掐点……」',
    mounts: m(A.suke, A.hoodie, A.table, A.phone),
    sourceQuote: '苏可（看着鱼丸，又看着手机）：「妈……你可真会掐点……」',
  },
  {
    title: '深吸一口气 · 整理乱发', duration: 4,
    shotSize: '中景', lens: '35mm f/2.8', lighting: '窗光偏冷',
    imagePrompt: '中景。苏可深吸一口气，快速整理乱发，为接听通话做准备。',
    cameraMove: '慢推', dialogue: '无', sfx: '整理头发的窸窣声',
    videoPrompt: '{0-4s} 缓推。她深吸一口气，整理了一下乱发，蓄势待发。',
    mounts: m(A.suke, A.hoodie, A.table),
    sourceQuote: '她深吸一口气，整理了一下乱发。',
  },
  {
    title: '切换乖巧滤镜 · 点击接听', duration: 4,
    shotSize: '近景', lens: '50mm f/2.0', lighting: '屏幕冷光 + 窗光',
    imagePrompt: '近景。苏可点击接听的瞬间，表情从生无可恋秒切成「乖巧且虚弱」的滤镜。',
    cameraMove: '定镜', dialogue: '无', sfx: '接听「叮」的提示音',
    videoPrompt: '{0-2s} 手指点击接听。{2-4s} 表情瞬间切换成乖巧虚弱，判若两人。',
    mounts: m(A.suke, A.hoodie, A.table, A.phone),
    sourceQuote: '她点击接听，瞬间切换成「乖巧且虚弱」的滤镜。',
  },
  {
    title: '甜美演技 · 喝白粥减肥', duration: 5,
    shotSize: '特写', lens: '85mm f/2.0', lighting: '屏幕冷光',
    imagePrompt: '特写。苏可对着屏幕，嗓音甜美，演技拉满地扮演「清纯大学生」。',
    cameraMove: '定镜', dialogue: '苏可（对屏幕，嗓音甜美）', sfx: '无',
    videoPrompt: '{0-5s} 定镜正对苏可。台词（甜美）：「喂妈？哎呀刚睡醒，正准备喝白粥呢，减肥嘛，不饿不饿……」',
    mounts: m(A.suke, A.hoodie, A.table, A.phone),
    sourceQuote: '苏可（对着屏幕，嗓音甜美）：「喂妈？哎呀刚睡醒，正准备喝白粥呢，减肥嘛，不饿不饿……」',
  },
  {
    title: '镜头拉远 · 左演戏右麻辣烫', duration: 5,
    shotSize: '全景', lens: '24mm f/4.0', lighting: '窗光偏冷 + 屏幕光',
    imagePrompt: '全景对照构图。画面左边苏可对着手机演「清纯大学生」，右边一碗冒着红油热气的豪华麻辣烫，反差强烈。',
    cameraMove: '拉远', dialogue: '妈妈（视频里）', sfx: '视频通话的电流底噪',
    videoPrompt: '{0-3s} 镜头拉远，露出左演戏、右麻辣烫的对照。{3-5s} 视频里妈妈：「可可啊，我怎么闻着你那边有股炸蛋的味道？」',
    mounts: m(A.suke, A.hoodie, A.table, A.phone, A.malatang),
    sourceQuote: '镜头拉远。画面左边是她对着手机屏幕演「清纯大学生」，右边是那一碗冒着红油、甚至还在冒热气的豪华麻辣烫。视频里妈妈：「我怎么闻着你那边有股炸蛋的味道？」',
  },
  {
    title: '瞳孔地震 · 筷子僵在半空 · 切黑', duration: 5,
    shotSize: '特写', lens: '100mm f/2.0', lighting: '屏幕冷光',
    imagePrompt: '特写。苏可瞳孔地震，拿着筷子的手在半空僵住，笑容凝固，随即画面切黑。',
    cameraMove: '快速推近', dialogue: '无', sfx: '戛然而止的静默',
    videoPrompt: '{0-3s} 快速推近苏可僵住的脸。{3-4s} 筷子悬在半空。{4-5s} 切黑。【禁止】背景音乐、画面内字幕。',
    mounts: m(A.suke, A.hoodie, A.table, A.phone, A.malatang),
    sourceQuote: '苏可瞳孔地震，拿着筷子的手在半空僵住。切黑。',
  },
]

// ── 组装：把上面的 ShotSeed 平铺成 Record<id, Shot>，并生成 scenes / episode ──
function buildScene(
  sceneId: string,
  no: number,
  name: string,
  location: string,
  timeOfDay: string,
  rawText: string,
  track: Scene['track'],
  seeds: ShotSeed[],
  shotStore: Record<string, Shot>,
): Scene {
  const shotIds = seeds.map((s, i) => {
    const id = `${sceneId}_sh${i + 1}`
    // 逐镜提示词在生成点统一注入；PROMPTS 缺条目时回退到 seed 里的一句话提示词。
    shotStore[id] = {
      ...s, id, sceneId, no: i + 1,
      imagePrompt: PROMPTS[id]?.image ?? s.imagePrompt,
      videoPrompt: PROMPTS[id]?.video ?? s.videoPrompt,
    }
    return id
  })
  return { id: sceneId, episodeId: 'e1', no, name, location, timeOfDay, rawText, shotIds, track }
}

const shots: Record<string, Shot> = {}

const scene1: Scene = buildScene(
  's1', 1, '客厅沙发', '客厅', '周六 中午 12:00',
  '周六 中午 12:00 · 客厅沙发\n\n特写镜头。苏可蜷缩在沙发里，手机屏幕疯狂闪烁。来电显示：「健身教练-王（15）」。\n\n苏可一脸「视死如归」，用脚趾把手机踢到了抱枕下面。手机在抱枕下闷声震动。\n\n苏可（碎碎念）：「看不见我……你看不见我……我已经在跑步机上猝死了……」\n\n震动停止。苏可像土拨鼠一样从抱枕里探出头，确认安全。她如释重负地瘫倒，刚想闭眼。\n\n「叮咚——」清脆的门铃声，在安静的房间里像防空警报。苏可整个人原地弹起，动作敏捷地钻到了大毛绒熊后面躲着。\n\n门外（外卖员喊声）：「尾号 0617 的外卖！加辣加臭加炸蛋的那份！没人在家我拿走退单了啊？」',
  {
    bgm: '轻快诙谐的弹拨乐，制造「宅家小心思」的喜剧节奏；门铃处一记急停。',
    mood: '从慵懒偷懒 → 被来电惊扰 → 门铃惊魂，情绪层层升级的喜剧张力。',
    fullDialogue: '苏可（碎碎念）：看不见我……你看不见我……我已经在跑步机上猝死了……\n外卖员（门外喊声）：尾号 0617 的外卖！加辣加臭加炸蛋的那份！没人在家我拿走退单了啊？',
  },
  scene1Shots, shots,
)

const scene2: Scene = buildScene(
  's2', 2, '玄关', '玄关到客厅', '3 分钟后',
  '3 分钟后 · 玄关到客厅\n\n镜头跟着苏可。她像特工一样，贴着墙根挪到门口，通过猫眼观察。走廊空无一人。地上放着一个冒着热气的袋子。\n\n她迅速开门，像抓猎物一样把外卖捞进来，迅速锁门，背靠门板大喘气。\n\n苏可（狂喜）：「呼……社交危机解除。现在是，我的时间。」',
  {
    bgm: '偷袭式的悬疑短音，随开门成功切换成一段释然的上扬音符。',
    mood: '潜行式的紧张 → 得手后的狂喜释然。',
    fullDialogue: '苏可（狂喜）：呼……社交危机解除。现在是，我的时间。',
  },
  scene2Shots, shots,
)

const scene3: Scene = buildScene(
  's3', 3, '餐桌', '客厅餐桌区', '紧接上场',
  '紧接上场 · 客厅餐桌区\n\n她欢快地跑到餐桌前，仪式感极强地铺开餐巾纸，掰开一次性筷子。拆开包装袋——红油的香味瞬间溢出屏幕。\n\n特写：她夹起一颗裹满汤汁的鱼丸，正要往嘴里送。\n\n手机再次亮起。不是电话，是一条微信视频邀请。备注：「亲妈」。停顿 5 秒。\n\n苏可（看着鱼丸，又看着手机）：「妈……你可真会掐点……」\n\n她深吸一口气，整理了一下乱发，点击接听，瞬间切换成「乖巧且虚弱」的滤镜。\n\n苏可（对着屏幕，嗓音甜美）：「喂妈？哎呀刚睡醒，正准备喝白粥呢，减肥嘛，不饿不饿……」\n\n镜头拉远。画面左边是她对着手机屏幕演「清纯大学生」，右边是那一碗冒着红油、甚至还在冒热气的豪华麻辣烫。\n\n视频里妈妈：「可可啊，我怎么闻着你那边有股炸蛋的味道？」\n\n苏可瞳孔地震，拿着筷子的手在半空僵住。切黑。',
  {
    bgm: '先是满足的美食小调，视频邀请响起时急转为紧张，结尾一记重音戛然而止。',
    mood: '独享美食的满足 → 被亲妈掐点打断的慌张 → 演技救场 → 被戳穿的社死定格。',
    fullDialogue: '苏可：妈……你可真会掐点……\n苏可（对屏幕，嗓音甜美）：喂妈？哎呀刚睡醒，正准备喝白粥呢，减肥嘛，不饿不饿……\n妈妈（视频里）：可可啊，我怎么闻着你那边有股炸蛋的味道？',
  },
  scene3Shots, shots,
)

const scenes: Record<string, Scene> = {
  [scene1.id]: scene1,
  [scene2.id]: scene2,
  [scene3.id]: scene3,
}

const assets: Record<string, Asset> = Object.fromEntries(assetList.map((a) => [a.id, a]))

export const seedProject: Project = {
  id: 'proj_last_dignity',
  title: '最后的尊严',
  aspect: '16:9',
  style: 'realistic',
  shotDensity: 'standard',
  stage: 'analysis',
  episodes: [
    { id: 'e1', no: 1, title: '外卖与尊严', sceneIds: ['s1', 's2', 's3'] },
  ],
  scenes,
  shots,
  assets,
}

// 供 R6 重拆使用：第 1 场镜头的初始副本（深拷贝，避免被运行时修改污染）。
export function initialSceneShots(sceneId: string): { shotIds: string[]; shots: Record<string, Shot> } {
  const scene = scenes[sceneId]
  if (!scene) return { shotIds: [], shots: {} }
  const out: Record<string, Shot> = {}
  for (const id of scene.shotIds) {
    out[id] = structuredClone(seedProject.shots[id]!)
  }
  return { shotIds: [...scene.shotIds], shots: out }
}
