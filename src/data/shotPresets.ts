// 同一场的 紧凑 / 标准 / 舒缓 三套分镜预设。
// 真实产品里切换密度是重跑一次 AI；demo 里就是换一份预先拆好的假数据。
// 只给第 1 场（s1）做三套，其他场复用「标准」（即 seed 里的原镜）。
import type { Shot, ShotDensity } from './types'
import { A, m, seedProject } from './seed'
import { PROMPTS } from './prompts'

// 标准套 = seed 第 1 场的 8 镜，直接引用，避免重复维护。
const standardS1: Shot[] = seedProject.scenes.s1!.shotIds.map(
  (id) => seedProject.shots[id]!,
)

type PresetSeed = Omit<Shot, 'id' | 'sceneId' | 'no'>

// ── 紧凑：11 镜 · 32s，切得更碎，节奏更快 ──
const compactS1Seeds: PresetSeed[] = [
  { title: '手机屏幕来电特写', duration: 3, shotSize: '特写', lens: '100mm f/2.8', lighting: '冷白 4000K · 高对比', imagePrompt: '极近特写。手机屏幕高亮刺眼，来电显示「健身教练-王（15）」。', cameraMove: '慢推', dialogue: '无', sfx: '高频震动声', videoPrompt: '{0-3s} 缓推手机屏幕，疯狂闪烁。', mounts: m(A.suke, A.hoodie, A.living, A.phone), sourceQuote: '苏可蜷缩在沙发里，手机屏幕疯狂闪烁。来电显示：「健身教练-王（15）」。' },
  { title: '苏可蜷缩·视死如归', duration: 2, shotSize: '近景', lens: '50mm f/2.8', lighting: '自然光偏冷', imagePrompt: '近景。苏可蜷缩在沙发角落，一脸「视死如归」。', cameraMove: '定镜', dialogue: '无', sfx: '无', videoPrompt: '{0-2s} 定镜。苏可表情写满抗拒。', mounts: m(A.suke, A.hoodie, A.living), sourceQuote: '苏可一脸「视死如归」。' },
  { title: '脚趾踢手机', duration: 3, shotSize: '中景', lens: '35mm f/4.0', lighting: '自然光偏冷', imagePrompt: '中景。脚趾用力把手机推向抱枕，动作夸张。', cameraMove: '低角度跟随', dialogue: '苏可（碎碎念）', sfx: '织物摩擦声', videoPrompt: '{0-3s} 低角度跟随脚趾。台词：「看不见我……你看不见我……」', mounts: m(A.suke, A.hoodie, A.living, A.phone, A.pillow), sourceQuote: '用脚趾把手机踢到了抱枕下面。' },
  { title: '手机埋入抱枕', duration: 2, shotSize: '特写', lens: '85mm f/2.0', lighting: '自然光偏冷', imagePrompt: '特写。手机被抱枕完全盖住。', cameraMove: '定镜', dialogue: '无', sfx: '闷响', videoPrompt: '{0-2s} 手机没入抱枕下。', mounts: m(A.suke, A.hoodie, A.living, A.phone, A.pillow), sourceQuote: '手机在抱枕下闷声震动。' },
  { title: '抱枕下闷震', duration: 3, shotSize: '特写', lens: '85mm f/2.0', lighting: '自然光偏冷', imagePrompt: '特写。抱枕随震动轻颤，逐渐停止。', cameraMove: '定镜', dialogue: '无', sfx: '沉闷震动声', videoPrompt: '{0-3s} 抱枕抖动至静止。', mounts: m(A.suke, A.hoodie, A.living, A.pillow), sourceQuote: '手机在抱枕下闷声震动。' },
  { title: '土拨鼠探头', duration: 3, shotSize: '近景', lens: '50mm f/2.8', lighting: '柔和自然光', imagePrompt: '近景。苏可从抱枕堆探头张望。', cameraMove: '定镜', dialogue: '无', sfx: '寂静', videoPrompt: '{0-3s} 缓缓探头确认安全。', mounts: m(A.suke, A.hoodie, A.living, A.pillow), sourceQuote: '苏可像土拨鼠一样从抱枕里探出头，确认安全。' },
  { title: '如释重负瘫倒', duration: 3, shotSize: '中景', lens: '35mm f/2.8', lighting: '柔和自然光', imagePrompt: '中景。苏可瘫倒沙发，闭眼。', cameraMove: '慢推', dialogue: '无', sfx: '长舒叹气', videoPrompt: '{0-3s} 缓推。瘫倒想闭眼。', mounts: m(A.suke, A.hoodie, A.living), sourceQuote: '她如释重负地瘫倒，刚想闭眼。' },
  { title: '门铃惊起', duration: 3, shotSize: '全景', lens: '24mm f/4.0', lighting: '自然光偏冷', imagePrompt: '全景。门铃响，苏可原地弹起。', cameraMove: '手持', dialogue: '无', sfx: '「叮咚——」', videoPrompt: '{0-1s} 静。{1-3s} 门铃响，弹起。', mounts: m(A.suke, A.hoodie, A.living), sourceQuote: '「叮咚——」清脆的门铃声，在安静的房间里像防空警报。' },
  { title: '扑向毛绒熊', duration: 3, shotSize: '全景', lens: '24mm f/4.0', lighting: '自然光偏冷', imagePrompt: '全景。苏可敏捷扑向毛绒熊躲藏。', cameraMove: '快速推近', dialogue: '无', sfx: '窸窣声', videoPrompt: '{0-3s} 扑向毛绒熊。', mounts: m(A.suke, A.hoodie, A.living, A.bear), sourceQuote: '动作敏捷地钻到了大毛绒熊后面躲着。' },
  { title: '熊后露眼屏息', duration: 3, shotSize: '特写', lens: '85mm f/2.0', lighting: '自然光偏冷', imagePrompt: '特写。毛绒熊后露出苏可警惕的双眼。', cameraMove: '定镜', dialogue: '无', sfx: '屏息', videoPrompt: '{0-3s} 熊后露眼，屏息。', mounts: m(A.suke, A.hoodie, A.living, A.bear), sourceQuote: '钻到了大毛绒熊后面躲着。' },
  { title: '外卖员门外喊话', duration: 4, shotSize: '中景', lens: '35mm f/2.8', lighting: '自然光偏冷', imagePrompt: '中景。紧闭的门，画外传来喊话。', cameraMove: '定镜', dialogue: '外卖员（门外喊声）', sfx: '门外喊话声', videoPrompt: '{0-4s} 定镜对门。画外音：「尾号 0617 的外卖！加辣加臭加炸蛋的那份！」', mounts: m(A.suke, A.hoodie, A.living), sourceQuote: '门外（外卖员喊声）：「尾号 0617 的外卖！加辣加臭加炸蛋的那份！没人在家我拿走退单了啊？」' },
]

// ── 舒缓：5 镜 · 32s，长镜头为主，情绪更绵 ──
const looseS1Seeds: PresetSeed[] = [
  { title: '来电惊扰·踢手机埋抱枕', duration: 7, shotSize: '中景', lens: '35mm f/2.8', lighting: '冷白 4000K', imagePrompt: '中景长镜。手机闪烁来电，苏可视死如归，用脚趾把手机踢进抱枕下。', cameraMove: '低角度跟随', dialogue: '苏可（碎碎念）', sfx: '震动 + 织物闷响', videoPrompt: '{0-3s} 手机来电闪烁。{3-7s} 脚趾踢手机入抱枕，台词：「看不见我……你看不见我……我已经在跑步机上猝死了……」', mounts: m(A.suke, A.hoodie, A.living, A.phone, A.pillow), sourceQuote: '手机屏幕疯狂闪烁……用脚趾把手机踢到了抱枕下面。' },
  { title: '探头确认安全·瘫倒', duration: 7, shotSize: '近景', lens: '50mm f/2.8', lighting: '柔和自然光', imagePrompt: '近景长镜。震动停止，苏可探头张望确认安全，如释重负地瘫倒。', cameraMove: '慢推', dialogue: '无', sfx: '由震动转寂静 + 长舒叹气', videoPrompt: '{0-4s} 探头确认安全。{4-7s} 瘫倒沙发想闭眼。', mounts: m(A.suke, A.hoodie, A.living, A.pillow), sourceQuote: '苏可像土拨鼠一样从抱枕里探出头，确认安全。她如释重负地瘫倒。' },
  { title: '门铃惊魂·原地弹起', duration: 6, shotSize: '全景', lens: '24mm f/4.0', lighting: '自然光偏冷', imagePrompt: '全景。安静中门铃骤响，苏可原地弹起，如临大敌。', cameraMove: '手持', dialogue: '无', sfx: '「叮咚——」防空警报般', videoPrompt: '{0-2s} 安静。{2-3s} 门铃骤响。{3-6s} 苏可弹起。', mounts: m(A.suke, A.hoodie, A.living), sourceQuote: '「叮咚——」清脆的门铃声，在安静的房间里像防空警报。' },
  { title: '躲进毛绒熊后', duration: 6, shotSize: '全景', lens: '24mm f/4.0', lighting: '自然光偏冷', imagePrompt: '全景转特写。苏可敏捷钻到毛绒熊后，只露警惕双眼。', cameraMove: '快速推近', dialogue: '无', sfx: '窸窣躲藏声', videoPrompt: '{0-3s} 扑向毛绒熊。{3-6s} 推近熊后露出的半张脸，屏息。', mounts: m(A.suke, A.hoodie, A.living, A.bear), sourceQuote: '动作敏捷地钻到了大毛绒熊后面躲着。' },
  { title: '外卖员门外喊话', duration: 6, shotSize: '中景', lens: '35mm f/2.8', lighting: '自然光偏冷', imagePrompt: '中景。紧闭的门与门后屏息的苏可，画外喊话。', cameraMove: '定镜', dialogue: '外卖员（门外喊声）', sfx: '门外喊话声', videoPrompt: '{0-6s} 定镜对门。画外音：「尾号 0617 的外卖！加辣加臭加炸蛋的那份！没人在家我拿走退单了啊？」', mounts: m(A.suke, A.hoodie, A.living), sourceQuote: '门外（外卖员喊声）：「尾号 0617 的外卖！加辣加臭加炸蛋的那份！没人在家我拿走退单了啊？」' },
]

function withIds(sceneId: string, prefix: string, seeds: PresetSeed[]): Shot[] {
  return seeds.map((s, i) => {
    const id = `${sceneId}_${prefix}${i + 1}`
    return {
      ...s, id, sceneId, no: i + 1,
      imagePrompt: PROMPTS[id]?.image ?? s.imagePrompt,
      videoPrompt: PROMPTS[id]?.video ?? s.videoPrompt,
    }
  })
}

// 每个场 → 每种密度 → 完整 Shot[]。缺失的密度在 density.ts 里回退到标准。
export const shotPresets: Record<string, Partial<Record<ShotDensity, Shot[]>>> = {
  s1: {
    compact: withIds('s1', 'c', compactS1Seeds),
    standard: standardS1,
    loose: withIds('s1', 'l', looseS1Seeds),
  },
}
