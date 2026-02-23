/**
 * 坐标转换工具函数
 * 
 * 用于处理以下转换：
 * - Lat/Lon/Alt ↔ x/y/z 坐标
 * - 角度 ↔ normal向量
 */

/**
 * 从相机角度计算normal向量
 *
 * @param pitch 俯仰角（度），范围-90到90
 * @param yaw 偏航角（度），范围0到360
 * @param roll 翻滚角（度），范围-180到180（已弃用，保留参数以保持兼容性）
 * @returns 归一化的normal向量
 *
 * 说明：
 * - pitch：控制相机的垂直方向，正值向下看
 * - yaw：控制相机的水平旋转方向
 * - roll：控制相机的左右翻滚（已弃用，UI中不再显示，固定为0）
 */
export function calculateNormalFromAngle(pitch: number, yaw: number, roll: number): {
  x: number
  y: number
  z: number
} {
  // 将角度转换为弧度
  const pitchRad = (pitch * Math.PI) / 180
  const yawRad = (yaw * Math.PI) / 180

  // 计算normal向量
  // x = sin(yaw) * cos(pitch)
  // y = -sin(pitch)  (负号是因为俯仰角为正时向下看)
  // z = cos(yaw) * cos(pitch)
  const x = Math.sin(yawRad) * Math.cos(pitchRad)
  const y = -Math.sin(pitchRad)
  const z = Math.cos(yawRad) * Math.cos(pitchRad)

  // 归一化（确保长度为1）
  const length = Math.sqrt(x * x + y * y + z * z)
  if (length < 0.0001) {
    // 如果向量接近零，返回默认值（向下）
    return { x: 0, y: -1, z: 0 }
  }

  return {
    x: x / length,
    y: y / length,
    z: z / length,
  }
}
