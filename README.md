# 剧本分析 Demo · PhanthyMovie

一个能点能改的交互原型，用来验证「剧本分析」模块的产品逻辑。**不是**生产工程：没有后端、登录、权限，不接真 AI，所有「生成」都是假数据。刷新即回到初始状态。

演示剧本：《最后的尊严》第 1 集，3 场 25 镜 + 全部资产。

## 跑起来

```bash
npm i
npm run dev        # 本地开发
npm test           # 跑业务规则 + 着装角色 / 生产快照断言（应全绿）
npm run typecheck  # TypeScript strict 检查
npm run build      # 生产构建
```

## 一句话方针

**逻辑内核优先**——会错的规则写成不碰 UI 的纯函数（`src/services/`）并用测试（`src/tests/*.test.ts`）焊死，界面只是这套规则的派生视图。

## 资产模型：五类资产 + 两批生产 + 单向影响（v1.2）

- **五类资产**：基础资产 `角色 / 服装 / 场景 / 道具`（`BaseAssetKind`）+ 关系资产 `着装角色（look）`。
  - **服装**是完全独立的基础资产，不再「属于某个角色」；「被哪些角色穿」由 `Look[]` 派生。
  - **着装角色 = 角色 × 服装**，是 AI 给定的确定关系（`Look.characterId / costumeId` **只读**），也是分镜里唯一的人物参考。改提示词不会改变这两个引用。
- **分镜挂载**只认 `着装角色 / 场景 / 道具`（`MountKind`）；**独立服装不自动挂载**。
- **两批生产**：点「资产生产」只下发第一批四类基础资产（`character/costume/location/prop`），**不含着装角色**；着装角色在基础资产定稿后另行生成。
- **单向影响**：剧本分析是源，视觉筹备 / 项目资产库是下游副本。上游改提示词（`updateAssetPrompt`）只让下游**过期 / 待重新同步**（`revision > productionRevision`），绝不被下游反向覆盖。改角色 / 服装会连带把依赖它的着装角色标记失效；改着装角色只影响自身。
- **字段级权限**取代整页只读：进入视觉筹备后剧本分析**仍可编辑**，脚本改动统一抬 `scriptRevision`，只有着装角色内部的角色—服装参考关系恒定锁定（`analysisPermissions`）。

## 目录导读（建议按此顺序读）

1. `src/data/types.ts` —— 全部领域类型，产品契约（含 `Look` / `BaseAssetKind` / `ProductionSnapshot`）
2. `src/services/*` —— 业务规则，纯函数
   - `timeline.ts` R1 时长累计时间轴
   - `mount.ts` R4 自动挂载（只认 look/location/prop，服装不自动挂载）
   - `looks.ts` 着装角色关系查询与出场统计
   - `reference.ts` 参考图清单（直接引用 look/location/prop）
   - `production.ts` 第一批筛选 / 生产快照 / 过期判断 / 依赖影响
   - `incremental.ts` R3 追加集与资产去重
   - `density.ts` R5 重拆颗粒度（含 `resplitSceneDensity`）
   - `lock.ts` R6 阶段先后 + 字段级权限（`analysisPermissions`）
   - `replace.ts` R8 剧本导入两种模式
   - `completeness.ts` R9 资产完整性提示（缺着装角色 / 场景，不再有「未指定服装」）
   - `duration.ts` R10 长镜头阈值
   - （R2 挂载是引用不是复制，由数据结构保证）
3. `src/tests/*.test.ts` —— 规则断言，中文描述即产品规则（`rules` / `looks` / `production` / `assets` / `prompts` / `appearance`）
4. `src/store/useStore.ts` —— 一个 Zustand store，承载 project 与全部动作（含 `updateAssetPrompt` / `startAssetProduction`）
5. `src/pages/*`、`src/components/*` —— 界面

## 能真点的交互

集/场树切换 · 四个 tab · 本场剧本竖条展开 · 挂载增删 · 深/浅主题切换 · 左侧导航收起 ·
**改时长后续镜顺移** · **场级设定抽屉（情绪 / 配乐，配乐去向拍摄台）** ·
**未挂载资产一键挂上**（规则 1 的黄色胶囊）· **长镜头非阻断预警**（行 / 时间轴 / 重拆弹窗三处）·
**重拆本场：颗粒度弹窗**（紧凑 / 标准 / 舒缓 / 指定镜数，镜数实时算）·
**集级 ⋯ 菜单**（重拆本集 / 追加剧集 / 替换本集 / 删除本集）·
**追加第 2 集（资产去重）** · **删除集只清「仅本集」资产** ·
**角色卡展开着装角色（角色 × 服装的只读关系 + 各自可编辑提示词）** ·
**服装卡反查「用于 N 个着装角色」** · **五类资产提示词就地编辑，改后即标「待重新生成」** ·
**「资产生产」确认页只统计第一批四类基础资产** ·
**进入视觉筹备后仍可返回改脚本 / 提示词，单向影响令下游过期而不覆盖**

（加粗为产品逻辑，是这个 demo 的存在意义。）

## 规则版本追溯

业务规则（`src/services/*` 的纯函数）会随需求演进，为了能追溯「某条断言属于哪个版本、何时改的」，约定如下：

- **基线版本**：**v1.0**（《剧本分析-交接文档-v1.0.md》第六章 · 2026-08-10）；当前规则集累计到 **v1.2**（资产页改造：着装角色 / 两批生产 / 单向影响 / 字段级权限，2026-08-12）。R4 / R9 已抬到 v1.2。
- **整体版本号**：`src/tests/rules.test.ts` 顶部的 `RULES_VERSION` 常量（现为 `v1.2`），大版本升级才动它。
- **规则级**：每条规则的 `describe` 前标 `since`（首次引入）/ `updated`（最近一次修改）。
- **断言级**：每个 `it` 断言体首行挂行内标记，如 `// v1.0`。
- **实现文件**：各 `services/*.ts` 头注写明该规则的版本，并指向对应的测试断言。

**规则改动时怎么标**（以 R1 为例）：

1. 把 R1 那条 `describe` 的 `updated v1.0` → `updated v1.1`；
2. 受影响的 `it` 行内标记 `// v1.0` → `// v1.1`（未改的保持原值）；
3. `services/timeline.ts` 头注的规则版本同步抬一档；
4. 只有整体大版本升级才改 `RULES_VERSION`。

这样 `git blame` / diff 就能一眼定位每条断言是哪个版本引入或修改的。

## 部署

推送到 `main` 触发 `.github/workflows/deploy.yml`：跑测试 → 构建 → 发到 GitHub Pages。
`vite.config.ts` 从 `GITHUB_REPOSITORY` 环境变量推 `base`，本地为 `/`。

## 技术选型

Vite + React + TypeScript(strict) + Zustand + CSS Modules + Vitest。运行时依赖只有 `react` `react-dom` `zustand` 三个。
