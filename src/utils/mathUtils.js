/**
 * 通用工具函数
 */

/** 线性插值 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** 限幅 */
export function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

/** 帧率无关的阻尼逼近（指数平滑） */
export function damp(current, target, lambda, dt) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

/** 角度差（弧度，结果归一化到 -PI ~ PI） */
export function angleDelta(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** 数字缓动：在 duration 秒内从 0 走到 1 的 easeInOutCubic */
export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** 等待指定毫秒 */
export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
