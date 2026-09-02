# 剧本分析 Demo · PhanthyMovie

一个能点能改的交互原型，用来验证「剧本分析」模块的产品逻辑。**不是**生产工程：没有后端、登录、权限，不接真 AI，所有「生成」都是假数据。刷新即回到初始状态。

演示剧本：《最后的尊严》第 1 集，4 800 字 → 3 场 25 镜 + 全部资产。

## 主流程

```
① 整理剧本（上传 / 拆集 / 校对） → ② 确认资产清单 → ③ 生成分镜脚本（拆场 / 拆镜） → ④ 生成提示词 → 去项目资产库生图
```

每一步是一张页 + 右下角一个下一步，主线上零弹窗。**步骤③ 之前只有「集」这一个实体**：场与镜头是「开始拆分」的产物，在那之前页面上不会出现「第 N 场」。

## 跑起来

```bash
npm i
npm run dev        # 本地开发
npm run typecheck  # TypeScript strict 检查
npm test           # 纯函数单测（4 个文件 / 32 条）
npm run lint       # oxlint
npm run build      # 生产构建
```

## 目录

```
src/data/types.ts   全部领域类型，产品契约
src/data/seed.ts    演示数据（第 1 集全量）+ prompts/ 逐镜提示词语料
src/services/       20 个纯函数模块，不碰 UI（见下）
src/store/useStore.ts  一个 Zustand store，承载 project 与全部动作
src/pages/          7 个页面
src/components/     27 个组件（Dialog 是全部弹窗的公共壳，icons 是共享图标）
src/styles/         theme.css 设计令牌 · global.css · ui.module.css 原子类 · dialog.module.css 弹窗公共壳
```

`src/services/` 里值得先读的几个：

- `timeline.ts` 时长是累计时间轴
- `capability.ts` 能力矩阵（字段级编辑权限，取代一刀切的阶段锁）
- `candidates.ts` 候选资产的抽取与入库
- `incremental.ts` 追加集与资产去重
- `appearanceIndex.ts` 出场记录派生索引（不落库）
- `reference.ts` / `staleness.ts` 引用态与单向传播
- `mentions.ts` 「文本 ↔ 资产」对账（散文里的名字就是普通汉字，挂载列才是结构化真相）
- `dialogue.ts` 对白 · 旁白的字符串 DSL 编解码
- `density.ts` 重拆颗粒度 · `lock.ts` 重拆与删集 · `completeness.ts` 资产完整性提示 · `duration.ts` 长镜头阈值

## 几条容易记反的口径

- **项目资产库只增不减。** 删场、删集、替换文本、重新拆解都不会减少资产；本集独有的资产只是变成「未引用」。**删除资产的唯一入口是项目资产库本身。**
- **单向传播，只标不重生。** 改资产提示词 / 换造型 → 引用它的镜头标「待更新」，不会自动重新生成。
- **挂载是引用不是复制。** 改资产名，所有挂载点自动跟随；但散文正文不会自动改。
- **挂到镜头上的是「着装角色」（look），不是裸角色 + 服装两条。**

## 能真点的交互

集/场树切换 · 本场剧本竖条展开 · 挂载增删 · 深/浅主题切换 · 左侧导航收起 ·
改时长后续镜顺移 · 场级设定抽屉（情绪 / 配乐）· 未挂载资产一键挂上 · 长镜头非阻断预警 ·
重拆本场颗粒度弹窗（紧凑 / 标准 / 舒缓 / 指定镜数，镜数实时算）· 上传弹窗 → 整页研读动效 ·
三段整页动效各跨一步（整理 → ① / 提取 → ② / 拆分 → ③）· 整理剧本页（上传 / 拆集 / 集级锁）·
节奏弹窗（镜数区间 · 秒/镜 · 价格随档位联动）· 集级 ⋯ 菜单（重新拆分本集 / 删除本集）·
删除镜头可撤销（5 秒内 toast 撤销）· 生成范围快速切换（本场 / 本集 / 全剧）· 提示词四状态与手动编辑标记（✎）

## 测试口径

只保留**纯函数**单测：`candidates` 候选去重与结算 · `promptScope` 生成范围求解 ·
`mentions` 实体词表的长词优先 · `dialogue` 对白 DSL 的解析与往返。

不写、也不要补：demo 语料的长度阈值 / 段落齐全性断言、UI 集成断言、以及任何形式的「规则版本追溯」标记。
这些在此前的版本里存在过，代价是每改一次口径就要手工同步一批标记，而收益为零——CI 并不跑它们。

## 部署

推送到 `master` / `main` 触发 `.github/workflows/deploy.yml`：`npm ci` → `npm run build` → 发到 GitHub Pages。

**CI 只做构建，不跑测试、不跑 lint**（`tsc -b` 随 build 一起跑，所以类型错误会拦住部署）。
`npm test` / `npm run lint` 请在本地跑。

`vite.config.ts` 从 `GITHUB_REPOSITORY` 环境变量推 `base`，本地为 `/`。

## 技术选型

Vite + React 19 + TypeScript(strict) + Zustand + CSS Modules + Vitest。运行时依赖只有 `react` `react-dom` `zustand` 三个。
