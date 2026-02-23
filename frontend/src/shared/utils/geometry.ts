/**
 * 几何计算工具函数
 * 提供基础的距离计算，供播放、时间轴、KPI 等前端展示使用
 */

/**
 * 计算两点之间的3D距离
 */
export function distance3D(
  p1: { x: number; y: number; z: number },
  p2: { x: number; y: number; z: number }
): number {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const dz = p2.z - p1.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}
