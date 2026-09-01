// 规则演练。每条既是右下角速查面板上的一个 ▷ 按钮，也是 tests/drills.test.ts 的一条断言。
// 规则版本：v2.0。单一真相源：同一份 DRILLS 供「人点」与「CI 跑」两个消费者。
import { useStore, type StoreState } from '../store/useStore'
import { seedProject, A } from '../data/seed'

export type LibExpect = 'noloss' | 'same' | 'minus'

export interface DrillApi {
  get: () => StoreState
  act: StoreState // 全部动作（zustand actions 引用稳定）
  snapshot: () => { lib: number; cand: number; scenes: number; shots: number }
}

export interface DrillRun {
  label: string
  /** 前置准备。在度量快照之前执行，不计入本次变化量。 */
  arm?: (api: DrillApi) => void
  run: (api: DrillApi) => void
  expect: { lib: LibExpect; gate: boolean }
}

export interface Drill {
  id: string
  group: string // 分组标题
  op: string    // 操作
  chk: string   // 核对点
  lib: string   // 资产库口径
  shot: string  // 分镜口径
  stop: string  // 是否停下
  runs: DrillRun[]
}

/** 把真实 store 复位到样例状态（已入库 + 有分镜），返回演练句柄。 */
export function freshDrillStore(): DrillApi {
  useStore.setState({
    project: structuredClone(seedProject),
    candidates: [],
    pendingTask: null,
    trace: { sawIncrementalGate: false },
    promptStates: {},
    promptEdited: {},
  })
  return makeDrillApi()
}

export function makeDrillApi(): DrillApi {
  const snapshot = () => {
    const st = useStore.getState()
    return {
      lib: Object.keys(st.project.assets).length,
      cand: st.candidates.length,
      scenes: Object.keys(st.project.scenes).length,
      shots: Object.keys(st.project.shots).length,
    }
  }
  return { get: () => useStore.getState(), act: useStore.getState(), snapshot }
}

const G_SCRIPT = '② 剧本原文变了 → 对应范围重建分镜'
const G_DELETE = '删除操作 → 资产库只增不减'
const G_LOOK = '造型手动挂载'
const G_ONEWAY = '单向传播'

export const DRILLS: Drill[] = [
  {
    id: 'append-gate', group: G_SCRIPT, op: '追加剧集', chk: '新增集原文',
    lib: '只增', shot: '只生成新集，旧集不动', stop: '有新候选才停',
    runs: [
      {
        label: '有新候选 → 开闸停下（此刻还没落库）',
        run: (api) => api.act.appendEpisode2(),
        expect: { lib: 'noloss', gate: true },
      },
      {
        label: '确认候选 → 结算入库，资产库净增',
        run: (api) => { api.act.appendEpisode2(); api.act.commitCandidates() },
        expect: { lib: 'noloss', gate: true },
      },
    ],
  },
  {
    id: 'replace-episode', group: G_SCRIPT, op: '替换本集', chk: '新集原文',
    lib: '只增（旧集独有资产变未引用，不删）', shot: '仅换本集', stop: '有新候选才停',
    runs: [
      {
        label: '替换第 1 集有新候选 → 开闸',
        run: (api) => api.act.replaceEpisode('e1'),
        expect: { lib: 'noloss', gate: true },
      },
    ],
  },
  {
    id: 'resplit-missed', group: G_SCRIPT, op: '重拆本场（有漏提）', chk: '本场原文',
    lib: '只增', shot: '仅本场', stop: '有漏提才停',
    runs: [
      {
        label: '重拆第 1 场（预置漏提）→ 开闸',
        run: (api) => api.act.resplit('s1', {}),
        expect: { lib: 'noloss', gate: true },
      },
    ],
  },
  {
    id: 'resplit-clean', group: G_SCRIPT, op: '重拆本场（无漏提）', chk: '本场原文',
    lib: '不变', shot: '仅本场', stop: '零候选不打断',
    runs: [
      {
        label: '重拆第 2 场（无漏提）→ 不开闸、直接续跑',
        run: (api) => api.act.resplit('s2', {}),
        expect: { lib: 'same', gate: false },
      },
    ],
  },
  {
    id: 'resplit-episode', group: G_SCRIPT, op: '重拆本集', chk: '本集原文',
    lib: '只增', shot: '本集各场', stop: '任一场有漏提即停',
    runs: [
      {
        label: '重拆第 1 集（含第 1 场漏提）→ 开闸',
        run: (api) => api.act.resplitEpisode('e1', { density: 'standard' }),
        expect: { lib: 'noloss', gate: true },
      },
    ],
  },
  {
    id: 'delete-scene', group: G_DELETE, op: '删场', chk: '删一个场',
    lib: '一条不减', shot: '级联删镜', stop: '不开闸',
    runs: [
      {
        label: '删第 2 场 → 资产库不变',
        run: (api) => api.act.deleteScene('s2'),
        expect: { lib: 'same', gate: false },
      },
    ],
  },
  {
    id: 'delete-episode', group: G_DELETE, op: '删集', chk: '删一个集',
    lib: '一条不减（本集独有资产变未引用）', shot: '级联删场镜', stop: '不开闸',
    runs: [
      {
        label: '先追加并入库第 2 集，再删第 2 集 → 资产库不减',
        arm: (api) => { api.act.appendEpisode2(); api.act.commitCandidates() },
        run: (api) => api.act.deleteEpisode('e2'),
        expect: { lib: 'same', gate: false },
      },
    ],
  },
  {
    id: 'delete-shot', group: G_DELETE, op: '删镜', chk: '删一个镜',
    lib: '一条不减', shot: '顺延重编号', stop: '不开闸',
    runs: [
      {
        label: '删第 1 场第 1 镜 → 资产库不变',
        run: (api) => api.act.deleteShot('s1_sh1'),
        expect: { lib: 'same', gate: false },
      },
    ],
  },
  {
    id: 'delete-asset', group: G_DELETE, op: '删资产（唯一减少出口）', chk: '资产库删一项',
    lib: '减一', shot: '挂载失效但保留', stop: '不开闸',
    runs: [
      {
        label: '从资产库删「餐巾纸与筷子」→ 资产库减一',
        run: (api) => api.act.deleteAsset(A.napkin),
        expect: { lib: 'minus', gate: false },
      },
    ],
  },
  {
    id: 'create-look', group: G_LOOK, op: '新建造型', chk: '给角色挂造型',
    lib: '只增', shot: '不动', stop: '不开闸',
    runs: [
      {
        label: '给苏可新建一个造型 → 资产库净增一条 look',
        run: (api) => api.act.createLook(A.suke, [A.cardigan]),
        expect: { lib: 'noloss', gate: false },
      },
    ],
  },
  {
    id: 'set-costumes', group: G_LOOK, op: '换服装', chk: '改造型引用的服装',
    lib: '不变', shot: '引用镜头标待更新', stop: '不开闸',
    runs: [
      {
        label: '把苏可造型换成开衫 → 资产库数量不变',
        run: (api) => api.act.setLookCostumes(A.lookSuke, [A.cardigan]),
        expect: { lib: 'same', gate: false },
      },
      {
        label: '解除造型（回落默认着装）→ 资产库数量不变',
        run: (api) => api.act.setLookCostumes(A.lookSuke, []),
        expect: { lib: 'same', gate: false },
      },
    ],
  },
  {
    id: 'update-prompt', group: G_ONEWAY, op: '改资产提示词', chk: '改一版提示词',
    lib: '不变', shot: '引用镜头标待更新', stop: '不开闸',
    runs: [
      {
        label: '改苏可提示词 → 资产库数量不变、不开闸',
        run: (api) => api.act.updateAssetPrompt(A.suke, '苏可提示词改一版'),
        expect: { lib: 'same', gate: false },
      },
    ],
  },
  {
    id: 'insert-scene', group: G_SCRIPT, op: '插入空白场', chk: '不带原文的新场',
    lib: '不变', shot: '空场无镜', stop: '空白场不走闸',
    runs: [
      {
        label: '在第 1 集插入一个空白场 → 不开闸、资产库不变',
        run: (api) => api.act.insertScene('e1', 0),
        expect: { lib: 'same', gate: false },
      },
    ],
  },
]
