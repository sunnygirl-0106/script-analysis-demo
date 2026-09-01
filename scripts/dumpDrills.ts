// 从单一真相源 services/drills.ts 的 DRILLS 生成《规则演练清单.md》放到仓库根目录。
// 用法：npm run drills:md（背后是 tsx scripts/dumpDrills.ts）。
// 速查面板已在 v2.2 删除，这份 md 就是 DRILLS 唯一的人类可读出口。
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { DRILLS } from '../src/services/drills'

// 表头六列 ↔ Drill 的六个描述字段（group / op / chk / lib / shot / stop）。
const HEAD = ['分组', '操作', '查不查资产', '资产库变化', '分镜变化', '是否停下等确认']

// v3《剧本分析_流程与触发规则》§1 的核心六条口径，原文照抄，供演练对照。
const RULES = `## 附：v3 六条口径原文

**R1 · 先确认资产，再生成分镜**
剧本导入后的处理分为两个阶段：① AI 提取角色、服装、场景、道具，用户确认资产清单；② 资产确认并存入项目资产库后，再生成集、场、镜及分镜脚本。最终画面提示词和视频提示词属于下一阶段，不与分镜脚本同时生成。

**R2 · 项目资产库只增不减**
首次导入、追加剧集、新增场、替换集/场文本、重新拆解本集、重新拆解本场，只能向项目资产库新增资产，不自动覆盖或删除已有资产。

**R3 · 已有资产及图片受保护**
用户手动创建、修改、上传图片或生成图片的资产，不会被剧本重新分析自动覆盖。删除项目资产库中的资产只有一个入口：用户在项目资产库中主动删除。

**R4 · 同名资产按已有资产处理**
本次候选名称已存在于项目资产库时，不重复新增。若用户认为是同名的不同资产，由用户修改名称后再作为新资产保存。

**R5 · 资产确认后再写库**
AI 提取完成时，新增候选暂不写入项目资产库。用户确认后，系统才执行增量保存。

**R6 · 已入库资产回到项目资产库管理**
资产清单确认阶段用于检查本次提取结果。已入库资产的后续新增、删除、改名、提示词修改、图片上传和图片生成，统一在项目资产库中完成。
`

function row(cells: string[]): string {
  return `| ${cells.join(' | ')} |`
}

const lines: string[] = []
lines.push('# 规则演练清单')
lines.push('')
lines.push('> 本文件由 `npm run drills:md` 从 `src/services/drills.ts` 的 `DRILLS` 自动生成，请勿手改。')
lines.push('> 每条演练同时是 `tests/drills.test.ts` 的一条数据驱动断言。')
lines.push('')
lines.push(row(HEAD))
lines.push(row(HEAD.map(() => '---')))
for (const d of DRILLS) {
  lines.push(row([d.group, d.op, d.chk, d.lib, d.shot, d.stop]))
}
lines.push('')
lines.push(RULES)

const out = resolve(process.cwd(), '规则演练清单.md')
writeFileSync(out, lines.join('\n'), 'utf8')
console.log(`已生成 ${out}（${DRILLS.length} 条演练）`)
