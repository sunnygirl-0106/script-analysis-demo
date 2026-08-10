# 剧本分析 Demo · PhanthyMovie

一个能点能改的交互原型，用来验证「剧本分析」模块的产品逻辑。**不是**生产工程：没有后端、登录、权限，不接真 AI，所有「生成」都是假数据。刷新即回到初始状态。

演示剧本：《最后的尊严》第 1 集，3 场 25 镜 + 全部资产。

## 跑起来

```bash
npm i
npm run dev        # 本地开发
npm test           # 跑 7 条业务规则的断言（应全绿）
npm run typecheck  # TypeScript strict 检查
npm run build      # 生产构建
```

## 一句话方针

**逻辑内核优先**——会错的规则写成不碰 UI 的纯函数（`src/services/`）并用测试（`src/tests/rules.test.ts`）焊死，界面只是这套规则的派生视图。

## 目录导读（建议按此顺序读）

1. `src/data/types.ts` —— 全部领域类型，产品契约
2. `src/services/*` —— 7 条业务规则，纯函数
   - `timeline.ts` R1 时长累计时间轴
   - `mount.ts` R4 挂载默认值（不是禁令）
   - `incremental.ts` R3 追加集与资产去重
   - `density.ts` R5 镜头密度
   - `lock.ts` R6 阶段锁与重拆
   - `imageQueue.ts` R7 不生图开关
   - （R2 挂载是引用不是复制，由数据结构保证）
3. `src/tests/rules.test.ts` —— 规则断言，中文描述即产品规则
4. `src/store/useStore.ts` —— 一个 Zustand store，承载 project 与全部动作
5. `src/pages/*`、`src/components/*` —— 界面

## 能真点的交互

集/场树切换 · 四个 tab · 本场剧本竖条展开 · 镜头行手风琴展开 · 字段下拉编辑 · 挂载增删 ·
**改时长后续镜顺移** · **场级栏（配乐/情绪/完整台词）** · **切镜头密度重排** ·
**追加第 2 集（资产去重）** · **不生图开关** · **重拆本场** · **进入视觉筹备后剧本分析置灰只读** · **深/浅主题切换**

（加粗为本次新增的产品逻辑，是这个 demo 的存在意义。）

## 部署

推送到 `main` 触发 `.github/workflows/deploy.yml`：跑测试 → 构建 → 发到 GitHub Pages。
`vite.config.ts` 从 `GITHUB_REPOSITORY` 环境变量推 `base`，本地为 `/`。

## 技术选型

Vite + React + TypeScript(strict) + Zustand + CSS Modules + Vitest。运行时依赖只有 `react` `react-dom` `zustand` 三个。
