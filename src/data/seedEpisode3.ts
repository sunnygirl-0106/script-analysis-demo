// 第 3 集：专供「上传文件 · 解析新集」演示，初始不加载。
// 关键点：既含老角色「苏可」（应被去重复用旧 id），又含新增资产（应新建）。
// 新集该带什么资产就带什么 —— 净增数量由内容决定，不是一个写死的常数。
// 本集新增：角色「房东」+ 服装「碎花围裙」+ 道具「催租单」。
import type { Episode, EpisodePayload, Scene, Shot, Asset, Look, MountRef } from './types'
import { A, m } from './seed'
import { EP3_CHUNKS, joinChunks } from './rawScripts'
import { PROMPTS } from './prompts'

/** 追加集的入口 id。store / 页面一律引用它，不再散落字面量 'e3'。 */
export const SUPPLEMENT_EP_ID = 'e3'

// 第 3 集内部临时 id：苏可用临时 id，交给 appendEpisode 按名称去重后重指向旧 id。
const T = {
  suke: 'c_suke__ep3', // 老角色（临时 id，会被 appendEpisode 重定向到 c_suke）
  landlord: 'c_landlord', // 新角色：房东
  apron: 'cos_apron', // 新服装：碎花围裙，与角色素模分开生成再融合
  notice: 'p_notice', // 新道具：催租单
  landlordLook: 'lk_landlord_apron', // 新着装角色：房东穿围裙的定妆图
} as const

// 第 3 集带来的资产（其余场景 / 道具 / 服装直接复用前两集的既有 id）。
// 追加集不设「只能新增几个」的上限：这一集出现了新道具就建新道具。
export const ep3Assets: Asset[] = [
  {
    id: T.suke, kind: 'character', role: 'lead',
    name: '苏可', // 与第 1 集同名 → 归一化后命中，复用旧 id
    imagePrompt: '（与第 1 集同一角色，复用既有设定板）',
    promptRevision: 0,
  },
  {
    id: T.landlord, kind: 'character', role: 'support',
    name: '房东',
    imagePrompt: `【生成规格】角色素模基础视觉资产设定板 · 纯白无缝背景 · 16:9 横版构图 · 三视图并排（正面 / 左侧 90° 正侧 / 背面全身站姿），三视图人物等高等比、脚底落在同一条水平线上 · 人物占画面高度 85%，头顶与脚尖各留约 5% 余量 · 相机为等效 85mm 中长焦、平视、无透视畸变 · 无投影落到背景 · 完整人物不裁切。
【体型】52 岁上下东亚女性，身高约 158cm，中等偏胖：肩圆，上臂与前臂都有明显的软肉，胸腹一体、腰线基本消失，臀部宽而下坠，小腿结实。这是「操持了半辈子家务」的体型，敦实、稳当，不是发福的富态，也不是干瘦的劳作感。站姿是双脚略分开、重心压实的自然站立，双手自然垂在身侧，肩略前倾。
【面部】圆脸偏方，颧骨略高，面颊松软下垂，法令纹与眼下的细纹清晰可见；眼裂中等，眼神精明有神、带着一点常年打量人的审视感；眉毛稀疏、眉尾修过、形状偏平；鼻梁不高，鼻头圆，鼻翼宽；嘴唇偏薄，嘴角平直，静止时略微下压。表情中性，不凶也不笑，但一眼看得出「不好糊弄」。眼神平视镜头。
【发型】黑发夹杂少量自然白发，及肩略短的直发，在脑后随手挽成一个松松的低发髻，用一根深色发圈固定；额前与鬓角有几缕掉出来的碎发；发质偏干、光泽度低，发际线略后退。
【肤色气质】东亚中性偏黄的肤色，日常在楼道与市场之间来回走动，手背与颈部略深于面部；皮肤保留真实的毛孔、色斑与细纹，不磨皮、不美化；整体气质是热心、直接、嗓门大、算账清楚的社区中年女性。
【手部】双手自然垂在身侧，手指舒展；手掌厚实，指节略粗，指腹有做家务留下的粗糙感，指甲修剪短而整齐；左手无名指戴一枚朴素的细金戒指，无其他饰品。每只手恰好五指、结构正确 —— 后续「叉腰 / 举催租单」的镜头以此为融合依据。
【基础着装】仅穿中性灰的贴身短袖上衣与同色系贴身长裤，面料为无光泽的纯棉针织，版型贴合但不勒，用于清晰交代肩背厚度与四肢围度。本设定板是素模，戏服与配件一律由服装资产单独生成后再融合，此处不出现任何戏服。
【三视图要求】三个视图必须是同一个人在同一时刻的三个角度，不是三张各自生成的图：身高、头身比、发型、肤色、体型、基础着装必须完全一致。正面视图眼神平视镜头、双肩水平；正侧视图鼻尖朝向画面左侧、耳廓完整可见、能读出圆润的肩背与略前倾的颈部；背面视图能看清脑后那个低发髻的形状。三视图之间留出均匀间距，互不遮挡、互不重叠。
【光线】中性棚拍柔光。主光为正面偏上 45° 的大面积柔光箱，两侧各一盏等强度补光；色温 5500K，显色准确；全场无强阴影、无投影落到背景上；白背景纯净不发灰。
【质感】高细节写实渲染，真人摄影质感；皮肤的松弛与细纹、发丝的干涩、针织面料三种质感层次分明；轻微自然锐度，无过度锐化。
【禁止】画面内字幕、水印、logo、色卡、标注文字；围裙、纸张、袖套、拖鞋等任何戏服与配件；第二个人物入画；三视图之间人物比例、发型或五官不一致；手指数量错误或肢体变形；把人物做成刻薄的恶婆婆脸谱或过于喜剧化的小品形象；背景出现地面、阴影或渐变。`,
    promptRevision: 0,
  },
  {
    id: T.apron, kind: 'costume',
    name: '碎花围裙', aliases: ['围裙'],
    imagePrompt: `【生成规格】服装资产平铺图 · 纯白无缝背景 · 16:9 横版构图 · 左右两幅：左为围裙正面平铺（含颈带与腰带自然摊开），右为背面平铺（交代系带走向与口袋内衬） · 顶部垂直俯拍、镜头轴线垂直于台面、无透视畸变 · 无人物、无人台、无模特、无衣架。
【款式版型】家用半身连胸围裙：上半部为方形胸挡（宽约 26cm、高约 28cm），颈部为一条可调长度的织带；腰部两侧各接一根长约 70cm 的系带；裙身为直筒 A 型，长至膝盖上方；正面下方有一个横向大贴袋，中间车一道竖直分隔线，分成左右两格。
【颜色材质】底色为洗旧的浅米白，满印细密的小碎花——直径约 1.2cm 的暗红与藏青小花、配深绿细枝叶，图案排列规整但因久洗而整体褪色、对比度低。面料为薄纯棉平纹布，柔软、微微起皱、完全不反光，边缘有细密的包边线。
【工艺细节】胸挡四周、贴袋口、裙摆下沿均为同色系细密平缝线；系带为同布料自制、末端折边缝合；贴袋的分隔线针脚略歪，是家用缝纫机补过的痕迹。围裙上一律没有文字、logo、品牌标签与刺绣字样。
【配件】无。不含袖套、手套、帽子。
【状态】平铺自然而非熨烫展平：裙身有明显的横向折痕与几处久穿留下的软褶；胸挡靠右下方有一小片洗不掉的浅黄油渍；贴袋袋口边缘起毛、颜色比周围略深；系带上有反复打结留下的皱缩。这是一条天天系在身上的围裙，不是崭新样品。
【光线】中性棚拍柔光。顶部一盏大面积柔光箱作为主光，四周补光均匀；色温 5500K，显色准确，碎花的暗红与藏青不得偏紫；额外一盏极低角度的擦光带出棉布的折痕起伏；背景纯白不发灰、无投影。
【质感】高细节写实产品摄影质感；薄棉平纹的织纹、褪色印花的哑光、油渍处略深的浸润三种肌理清晰可辨；轻微自然锐度，无过度锐化。
【禁止】画面内字幕、水印；任何品牌名称、logo 或刺绣文字；人物、人台、模特、假人、衣架；把围裙做成餐厅制服、咖啡师围裙或工业防护服；崭新平整的电商商品图感；碎花做成大朵艳丽的花型；配件缺失或部分出画。`,
    promptRevision: 0,
  },
  {
    id: T.notice, kind: 'prop',
    name: '催租单', aliases: ['催缴单', '单子'],
    imagePrompt: `【生成规格】道具产品图 · 纯白无缝背景 · 16:9 横版构图 · 主图为顶部垂直俯拍（占画面 55%），右侧附一张 30° 斜俯小图（占画面 20%，交代纸张的厚度、卷边与胶带残留） · 等效 85mm、无透视畸变 · 极淡的接触影。
【形态】一张 A4 大小（21×29.7cm）的普通打印纸，纵向摆放，四边与画幅平行。纸面整体平整，但左上角有一道被撕下来时带出的斜向小破口（长约 2cm），右下角略微上卷。
【材质颜色】普通 70g 白色复印纸，表面哑光、有极细的纸张纹理与轻微的机器压痕；不是纯白，而是带一点点暖调的米白；纸张薄、能在擦光下看出轻微的透光。
【细节】纸面上是深灰黑色的激光打印痕迹，排版为「顶部一行居中的大字标题 + 中部三到四行左对齐的正文 + 底部一行加粗结论 + 右下角一小块签章位置」的结构。关键要求：所有这些内容一律以**无法辨认的、抽象的排版色块与虚化笔画**呈现 —— 有字的形状、有行距、有粗细对比，但读不出任何一个具体的字符、数字或语言。四角与顶边残留几小块半透明的透明胶带痕迹与一点点起毛的纸纤维（从门上撕下来留下的）。
【状态】一看就是「被人贴在门上、又被从门上撕下来」的纸：左上角有破口，四角有胶带残留，纸面有两三道浅浅的指印与一道横向的软折痕；不是刚从打印机里出来的挺括新纸。
【辅视图】右侧 30° 斜俯小图交代：纸张的厚度与右下角的上卷弧度、左上角破口的纤维断面、以及顶边胶带残留的半透明质感。小图与主图为同一张纸、同一光线条件。
【光线】中性棚拍柔光为底。主光为顶部偏左 30° 的柔光箱；额外从画面左侧打一盏极低角度的擦光，让纸面的折痕、指印与卷边产生细微但清晰的明暗起伏 —— 白纸在白背景上必须靠这层阴影分离出来；色温 5500K；曝光准确，纸面不过曝到丢失纹理；背景纯白不发灰。
【质感】高细节写实产品摄影质感；复印纸的哑光纤维、激光碳粉的微哑黑、胶带残胶的半透明三种质感层次分明；轻微自然锐度，无过度锐化。
【禁止】画面内可辨认的文字、数字、字符、金额、日期、姓名、地址、电话；任何 logo、公章图形或二维码；水印；把纸做成信封、账单表格或彩印传单；崭新挺括、四角完好的新纸；人物、手部入画。`,
    promptRevision: 0,
  },
  // 着装角色：房东穿碎花围裙。绑定关系永久只读（决策 1b）。imagePrompt 为 demo 占位。
  {
    id: T.landlordLook, kind: 'look',
    name: '房东 · 碎花围裙',
    characterId: T.landlord, costumeIds: [T.apron],
    imagePrompt: '【着装融合】房东 · 碎花围裙：把房东素模与洗旧的碎花围裙融合成穿好衣服的定妆图，人物一致性以角色素模为准、服装以围裙资产为准。',
    promptRevision: 0,
  } as Look,
]

/** 第 3 集自带的新资产，需手工构造 MountRef —— seed 的 m() 只认得前两集的资产。
 *  服装不参与挂载（决策 3b），房东挂的是着装角色 look，不是「角色 + 服装」两条。 */
const noticeMount: MountRef = { kind: 'prop', assetId: T.notice }
const landlordLookMount: MountRef = { kind: 'look', assetId: T.landlordLook }

type ShotSeed = Omit<Shot, 'id' | 'sceneId' | 'no'>

const ep3s1Shots: ShotSeed[] = [
  {
    title: '砸门三下 · 苏可定格', duration: 4,
    shotSize: '中景', lens: '35mm f/2.8', lighting: '客厅自然光偏冷',
    imagePrompt: '中景。苏可端着碗站在客厅中央，被门外三下重重的砸门声钉在原地，一步不敢挪。',
    cameraMove: '快速推近', dialogue: '房东（门外喊声）', sfx: '三下沉重的砸门声',
    videoPrompt: '{0-2s} 快速推近苏可僵住的上半身。{2-4s} 画外音（房东）：「小苏！在家吧！」',
    mounts: m(A.suke, A.hoodie, A.living, A.malatang),
    sourceQuote: '门被人「咚咚咚」砸响了三下……「小苏！在家吧！」',
  },
  {
    title: '猫眼视角 · 门外的房东', duration: 5,
    shotSize: '特写', lens: '85mm f/2.0', lighting: '走廊声控灯冷白',
    imagePrompt: '特写。猫眼视角的圆形画面：门外站着围着碎花围裙的房东，一手叉腰，一手举着催租单对着猫眼晃。',
    cameraMove: '定镜', dialogue: '房东：「我知道你在家啊。」', sfx: '走廊里的回声',
    videoPrompt: '{0-3s} 猫眼圆形视野里房东举起催租单晃了晃。{3-5s} 房东慢悠悠开口：「我知道你在家啊。」',
    mounts: [...m(A.suke, A.hoodie, A.entry), landlordLookMount, noticeMount],
    sourceQuote: '门外站着房东……围着一条洗得发白的碎花围裙，另一只手举着一张打印出来的催租单。',
  },
  {
    title: '背贴门板 · 缓缓蹲下', duration: 4,
    shotSize: '全景', lens: '24mm f/4.0', lighting: '玄关暖白偏暗',
    imagePrompt: '全景。苏可猛地从猫眼上挪开，背贴着门板缓缓蹲下，双手捂住嘴，一句话不敢说。',
    cameraMove: '跟随', dialogue: '无', sfx: '压得极低的呼吸声',
    videoPrompt: '{0-4s} 镜头跟着苏可从猫眼高度一路下滑到蹲坐在地。',
    mounts: m(A.suke, A.hoodie, A.entry),
    sourceQuote: '苏可猛地把眼睛从猫眼上挪开，背贴着门缓缓蹲下，捂住嘴。',
  },
]

const ep3s2Shots: ShotSeed[] = [
  {
    title: '开缝撕单 · 飞快关门', duration: 4,
    shotSize: '中景', lens: '35mm f/2.8', lighting: '玄关暖白偏暗',
    imagePrompt: '中景。门开一条缝，一只手飞快伸出去把贴在门上的催租单撕下来，门随即关上。',
    cameraMove: '手持', dialogue: '无', sfx: '撕纸声与关门声',
    videoPrompt: '{0-2s} 门缝里伸出手撕下催租单。{2-4s} 门「咔」地关上、反锁。',
    mounts: [...m(A.suke, A.hoodie, A.entry), noticeMount],
    sourceQuote: '她把门开了一条缝，伸手把那张贴在门上的催租单撕下来，飞快地关上门。',
  },
  {
    title: '催租单盖脸 · 手机扣桌', duration: 5,
    shotSize: '近景', lens: '50mm f/2.0', lighting: '客厅自然光偏冷',
    imagePrompt: '近景。苏可瘫在沙发里，把催租单盖在脸上；一只手从纸底下伸出来，把亮着的手机屏幕朝下扣在茶几上。',
    cameraMove: '慢推', dialogue: '苏可（纸下闷声）：「……人不能出门。」', sfx: '一声长叹与手机扣桌的轻响',
    videoPrompt: '{0-3s} 缓推。催租单盖在脸上，纸底下传出闷闷的自言自语。{3-5s} 一只手伸出来把手机扣在茶几上。',
    mounts: [...m(A.suke, A.hoodie, A.living, A.phone), noticeMount],
    sourceQuote: '把催租单盖在脸上……「我就说，人不能出门。」',
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
  return {
    id: sceneId, episodeId: SUPPLEMENT_EP_ID, no, name, location, timeOfDay,
    rawText, shotIds, density: 'standard', track,
  }
}

const ep3Shots: Record<string, Shot> = {}
const ep3s1 = buildScene(
  'e3s1', 1, '玄关门后', '玄关', '次日 上午 10:00',
  EP3_CHUNKS[0]!,
  { mood: '被砸门打断的松弛 → 认出讨债人后的僵直恐慌。', bgm: '低音提琴的短促断奏，一下一下压上来。' },
  ep3s1Shots, ep3Shots,
)
const ep3s2 = buildScene(
  'e3s2', 2, '客厅沙发', '客厅', '紧接上场',
  EP3_CHUNKS[1]!,
  { mood: '劫后余生 → 读到数字之后的认命自嘲。', bgm: '慢下来的钢琴单音，最后一记停在半空。' },
  ep3s2Shots, ep3Shots,
)

export const ep3Episode: Episode = {
  id: SUPPLEMENT_EP_ID, no: 3, title: '三日内结清', sceneIds: ['e3s1', 'e3s2'],
  rawText: joinChunks(EP3_CHUNKS),
  wordCount: 3200, // 演示口径，同 e1 / e2（v2.4 §2.1）
}

export const ep3Scenes: Record<string, Scene> = {
  [ep3s1.id]: ep3s1,
  [ep3s2.id]: ep3s2,
}

export const ep3ShotStore: Record<string, Shot> = ep3Shots

// 打包成 appendEpisode / fillEpisode 的输入。
export const episode3Payload: EpisodePayload = {
  episode: ep3Episode,
  scenes: ep3Scenes,
  shots: ep3ShotStore,
  assets: ep3Assets,
}
