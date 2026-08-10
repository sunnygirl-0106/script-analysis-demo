// 第 2 集：专供「追加集」演示，初始不加载。
// 关键点：既含老角色「苏可」（应被去重复用旧 id），又含新角色「快递员」（应新建）。
// 追加后全剧资产净增 1（只多了快递员）。
import type { Episode, Scene, Shot, Asset } from './types'
import { A, m } from './seed'

// 第 2 集内部临时 id：苏可用临时 id，交给 appendEpisode 按名称去重后重指向旧 id。
const T = {
  suke: 'c_suke__ep2', // 老角色（临时 id，会被 appendEpisode 重定向到 c_suke）
  courier: 'c_courier', // 新角色
} as const

// 第 2 集带来的资产（其余场景 / 道具 / 服装直接复用第 1 集的既有 id）。
export const ep2Assets: Asset[] = [
  {
    id: T.suke, kind: 'character', role: 'lead', skipImageGen: false,
    name: '苏可', // 与第 1 集同名 → 归一化后命中，复用旧 id
    description: '24 岁，资深宅家爱好者 / 资深吃货。第 2 集里她还得应付上门取件的快递员。',
    imagePrompt: '（与第 1 集同一角色，复用既有设定板）',
    appearances: [{ episodeNo: 2, sceneNo: 1 }, { episodeNo: 2, sceneNo: 2 }],
  },
  {
    id: T.courier, kind: 'character', role: 'extra', skipImageGen: true,
    name: '快递员',
    description: '男，约 30 岁。上门取退货件，敲门催得急，全程只闻其声。',
    imagePrompt: '（仅声音出演，不进入生图队列）',
    appearances: [{ episodeNo: 2, sceneNo: 2 }],
  },
]

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
    mounts: m(A.suke, A.hoodie, A.entry),
    sourceQuote: '（第 2 集续写）快递员：「取件的！退货件在家吗？」',
  },
  {
    title: '递出包裹 · 飞速关门', duration: 4,
    shotSize: '全景', lens: '24mm f/4.0', lighting: '玄关暖白偏暗',
    imagePrompt: '全景。苏可从门缝把退货包裹塞出去，飞速关门，全程不露正脸。',
    cameraMove: '手持', dialogue: '无', sfx: '门轴与关门声',
    videoPrompt: '{0-2s} 门缝递出包裹。{2-4s} 飞速关门。',
    mounts: m(A.suke, A.hoodie, A.entry),
    sourceQuote: '（第 2 集续写）她从门缝塞出包裹，飞速关门。',
  },
]

function buildScene(
  sceneId: string, no: number, name: string, location: string, timeOfDay: string,
  rawText: string, track: Scene['track'], seeds: ShotSeed[], shotStore: Record<string, Shot>,
): Scene {
  const shotIds = seeds.map((s, i) => {
    const id = `${sceneId}_sh${i + 1}`
    shotStore[id] = { ...s, id, sceneId, no: i + 1 }
    return id
  })
  return { id: sceneId, episodeId: 'e2', no, name, location, timeOfDay, rawText, shotIds, track }
}

const ep2Shots: Record<string, Shot> = {}
const ep2s1 = buildScene(
  'e2s1', 1, '客厅沙发', '客厅', '当天下午',
  '当天下午 · 客厅沙发\n\n挂断妈妈的视频后，苏可瘫软在沙发里。手机再次震动，是快递上门取件的提醒。她万般不情愿地爬起身。',
  { bgm: '慵懒的午后小调，被提醒音打断。', mood: '劫后余生的松弛 → 又被打扰的无奈。', fullDialogue: '（本场无对白）' },
  ep2s1Shots, ep2Shots,
)
const ep2s2 = buildScene(
  'e2s2', 2, '玄关取件', '玄关', '紧接上场',
  '紧接上场 · 玄关\n\n快递员在门外催促取件。苏可从门缝把退货包裹塞出去，飞速关门，全程社恐不露脸。',
  { bgm: '带点滑稽的紧张短音。', mood: '社恐式的应付，速战速决。', fullDialogue: '快递员（门外喊声）：取件的！退货件在家吗？下楼我可就走了啊！' },
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
