# 剧本分析 Demo · PhanthyMovie

一个能点能改的交互原型，用来验证「剧本分析」模块的产品逻辑。**不是**生产工程：没有后端、登录、权限，不接真 AI，所有「生成」都是假数据。刷新即回到初始状态。

演示剧本：《最后的尊严》第 1 集，3 场 25 镜 + 全部资产。

## 跑起来

```bash
npm i
npm run dev        # 本地开发
npm test           # 跑 9 条业务规则的断言（应全绿）
npm run typecheck  # TypeScript strict 检查
npm run build      # 生产构建
```

## 一句话方针

**逻辑内核优先**——会错的规则写成不碰 UI 的纯函数（`src/services/`）并用测试（`src/tests/rules.test.ts`）焊死，界面只是这套规则的派生视图。

## 目录导读（建议按此顺序读）

1. `src/data/types.ts` —— 全部领域类型，产品契约
2. `src/services/*` —— 9 条业务规则，纯函数
   - `timeline.ts` R1 时长累计时间轴
   - `mount.ts` R4 挂载默认值（不是禁令）
   - `incremental.ts` R3 追加集与资产去重
   - `density.ts` R5 重拆颗粒度（含 `resplitSceneDensity`）
   - `lock.ts` R6 阶段锁与重拆（含 `deleteEpisode`）
   - `replace.ts` R8 剧本导入两种模式
   - `completeness.ts` R9 资产完整性提示（三条真实规则）
   - `duration.ts` R10 长镜头阈值
   - （R2 挂载是引用不是复制，由数据结构保证）
3. `src/tests/rules.test.ts` —— 规则断言，中文描述即产品规则
4. `src/store/useStore.ts` —— 一个 Zustand store，承载 project 与全部动作
5. `src/pages/*`、`src/components/*` —— 界面

## 能真点的交互

集/场树切换 · 四个 tab · 本场剧本竖条展开 · 挂载增删 · 深/浅主题切换 · 左侧导航收起 ·
**改时长后续镜顺移** · **场级设定抽屉（情绪 / 配乐，配乐去向拍摄台）** ·
**未挂载资产一键挂上**（规则 1 的黄色胶囊）· **长镜头非阻断预警**（行 / 时间轴 / 重拆弹窗三处）·
**重拆本场：颗粒度弹窗**（紧凑 / 标准 / 舒缓 / 指定镜数，镜数实时算）·
**集级 ⋯ 菜单**（重拆本集 / 追加剧集 / 替换本集 / 删除本集）·
**追加第 2 集（资产去重）** · **删除集只清「仅本集」资产** ·
**进入视觉筹备前置确认弹窗**，确认后剧本分析置灰只读

（加粗为产品逻辑，是这个 demo 的存在意义。）

## 规则版本追溯

业务规则（`src/services/*` 的纯函数）会随需求演进，为了能追溯「某条断言属于哪个版本、何时改的」，约定如下：

- **基线版本**：**v1.0**（《剧本分析-交接文档-v1.0.md》第六章 · 2026-08-10）；当前规则集累计到 **v1.1**（技术方案 v1.1 / v1.2，2026-08-11）。R3 / R4 / R5 / R6 / R8 / R9 / R10 均已带 v1.1 标记。
- **整体版本号**：`src/tests/rules.test.ts` 顶部的 `RULES_VERSION` 常量（现为 `v1.1`），大版本升级才动它。
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
