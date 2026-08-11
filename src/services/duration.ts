// R10 长镜头阈值。纯函数。
// 规则版本：v1.1（2026-08-11）。断言见 tests/rules.test.ts 的 R10。
// 单一来源：分镜行 / 时间轴分段 / 重拆弹窗三处预警都引用这里，不各写各的数字。

/** 单镜超过这个秒数就提示"可能需要分段生成"。当前主流视频模型单次生成上限在 5–10s。 */
export const LONG_SHOT_SEC = 6

export function isLongShot(duration: number): boolean {
  return duration > LONG_SHOT_SEC
}
