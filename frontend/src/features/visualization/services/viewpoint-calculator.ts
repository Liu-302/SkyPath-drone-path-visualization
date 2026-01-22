/**
 * 视点信息计算服务
 * 
 * 文件作用：
 * - 计算选中视点的详细信息
 * - 从路径数据中提取照相机角度
 * - 计算已飞行距离、已用时间、当前速度等指标
 * 
 * 负责人：成员A
 * 使用方：成员A（在Visualize.vue中调用，当用户点击路径点时）
 */

import type { ViewpointDetail } from '@/features/visualization/types/viewpoint'
import type { PathPoint } from '@/stores/dataset'
import { distance3D } from '@/shared/utils/geometry'
import { ENERGY_CONFIG } from '@/shared/constants/constants'

/**
 * 计算视点详细信息
 * 
 * @param index 视点在路径中的索引
 * @param pathPoints 所有路径点（包含id, position, normal）
 * @returns 计算好的视点详细信息
 */
export function calculateViewpointDetail(
  index: number,
  pathPoints: PathPoint[]
): ViewpointDetail {
  if (index < 0 || index >= pathPoints.length) {
    throw new Error(`Invalid viewpoint index: ${index}`)
  }

  const currentPoint = pathPoints[index]
  
  // 1. 计算已飞行距离（从起点到该点的累计距离）
  const traveledDistance = calculateTraveledDistance(pathPoints, index)
  
  // 2. 计算已用时间（基于速度和距离）
  const elapsedTime = calculateElapsedTime(pathPoints, index)
  
  // 3. 计算当前速度（根据相邻点计算）
  const currentSpeed = calculateCurrentSpeed(pathPoints, index)
  
  // 4. 计算与上一视点的距离
  const distanceToPrevious = index > 0
    ? distance3D(
        { x: pathPoints[index - 1].x, y: pathPoints[index - 1].y, z: pathPoints[index - 1].z },
        { x: currentPoint.x, y: currentPoint.y, z: currentPoint.z }
      )
    : 0
  
  // 5. 从normal向量计算照相机角度（pitch, yaw, roll）
  const cameraAngle = calculateCameraAngleFromNormal(currentPoint.normal)
  
  return {
    index,
    position: {
      x: currentPoint.x,
      y: currentPoint.y,
      z: currentPoint.z,
    },
    cameraAngle,
    traveledDistance,
    elapsedTime,
    currentSpeed,
    distanceToPrevious,
  }
}

/**
 * 计算已飞行距离（从起点到指定索引点的累计距离）
 * 
 * @param pathPoints 所有路径点
 * @param index 目标点的索引
 * @returns 累计距离（米）
 */
function calculateTraveledDistance(pathPoints: PathPoint[], index: number): number {
  if (index === 0) return 0
  
  let totalDistance = 0
  for (let i = 1; i <= index; i++) {
    const p1 = pathPoints[i - 1]
    const p2 = pathPoints[i]
    totalDistance += distance3D(
      { x: p1.x, y: p1.y, z: p1.z },
      { x: p2.x, y: p2.y, z: p2.z }
    )
  }
  return totalDistance
}

/**
 * 计算已用时间（从起点到指定索引点的时间）
 * 
 * @param pathPoints 所有路径点
 * @param index 目标点的索引
 * @returns 已用时间（秒）
 */
function calculateElapsedTime(pathPoints: PathPoint[], index: number): number {
  if (index === 0) return 0
  
  const traveledDistance = calculateTraveledDistance(pathPoints, index)
  // 使用固定速度计算时间
  return traveledDistance / ENERGY_CONFIG.speed
}

/**
 * 计算当前速度（根据相邻点计算）
 * 
 * @param pathPoints 所有路径点
 * @param index 当前点的索引
 * @returns 当前速度（米/秒）
 */
function calculateCurrentSpeed(pathPoints: PathPoint[], index: number): number {
  // 固定速度：不再计算，始终返回配置中的速度
  return ENERGY_CONFIG.speed
}

/**
 * 从normal向量计算照相机角度（pitch, yaw, roll）
 * 
 * @param normal 相机朝向向量（归一化）
 * @returns 照相机角度（度）
 * 
 * 说明：
 * - pitch（俯仰角）：normal向量与水平面的夹角，范围-90到90
 * - yaw（偏航角）：normal向量在水平面上的投影与北方向的夹角，范围0到360
 * - roll（翻滚角）：基于Y-up坐标系假设计算
 * 
 * 关于 up 向量和 roll 的计算：
 * - Y-up 是坐标系约定：Y轴向上，即世界坐标系的上方向是 (0, 1, 0)
 * - up 向量是相机的"上方向"向量，表示相机认为哪个方向是"上"
 * - 即使系统使用Y-up坐标系，相机的up向量也可能不是 (0, 1, 0)，因为相机可能倾斜
 * - 基于Y-up假设和normal向量，我们可以计算出相机的up向量，然后计算roll
 */
export function calculateCameraAngleFromNormal(normal: { x: number; y: number; z: number }): {
  pitch: number
  yaw: number
  roll: number
} {
  // 计算pitch（俯仰角）
  // pitch = arcsin(-normal.y)，范围-90到90度
  // normal.y为负值时，相机向下看（俯仰角为正）
  const pitch = Math.asin(-normal.y) * (180 / Math.PI)
  
  // 计算yaw（偏航角）
  // yaw = arctan2(normal.x, normal.z) 转换为0-360度
  // 在Y-up坐标系中，Z轴通常是"北"方向，X轴是"东"方向
  let yaw = Math.atan2(normal.x, normal.z) * (180 / Math.PI)
  if (yaw < 0) yaw += 360
  
  // 计算roll（翻滚角）：基于Y-up坐标系假设
  // 1. 基于normal向量和Y-up，计算相机的up向量（假设roll=0时的期望up）
  // 2. 相机的实际up向量应该尽可能指向Y-up方向（在垂直于normal的平面内）
  // 3. 如果相机有roll，相机的up向量会偏离Y-up方向
  let roll = 0
  
  // 基于Y-up坐标系计算相机的up向量
  // 相机的up向量应该垂直于normal，并且尽可能接近Y轴方向
  const worldUp = { x: 0, y: 1, z: 0 } // Y-up坐标系的上方向
  
  // 计算right向量：normal × worldUp（叉积）
  const right = {
    x: normal.y * worldUp.z - normal.z * worldUp.y,
    y: normal.z * worldUp.x - normal.x * worldUp.z,
    z: normal.x * worldUp.y - normal.y * worldUp.x
  }
  
  const rightLen = Math.sqrt(right.x * right.x + right.y * right.y + right.z * right.z)
  
  if (rightLen > 0.001) {
    // 归一化right向量
    const rightNormalized = {
      x: right.x / rightLen,
      y: right.y / rightLen,
      z: right.z / rightLen
    }
    
    // 计算相机的up向量：right × normal（叉积）
    // 这个up向量垂直于normal和right，表示相机的"上方向"
    const cameraUp = {
      x: rightNormalized.y * normal.z - rightNormalized.z * normal.y,
      y: rightNormalized.z * normal.x - rightNormalized.x * normal.z,
      z: rightNormalized.x * normal.y - rightNormalized.y * normal.x
    }
    
    // 计算cameraUp与世界up在垂直于normal的平面内的夹角，这就是roll
    // 将worldUp投影到垂直于normal的平面上
    const normalDotWorldUp = normal.x * worldUp.x + normal.y * worldUp.y + normal.z * worldUp.z
    const projectedWorldUp = {
      x: worldUp.x - normal.x * normalDotWorldUp,
      y: worldUp.y - normal.y * normalDotWorldUp,
      z: worldUp.z - normal.z * normalDotWorldUp
    }
    
    const projLen = Math.sqrt(
      projectedWorldUp.x * projectedWorldUp.x + 
      projectedWorldUp.y * projectedWorldUp.y + 
      projectedWorldUp.z * projectedWorldUp.z
    )
    
    if (projLen > 0.001) {
      // 归一化投影向量
      const projectedWorldUpNormalized = {
        x: projectedWorldUp.x / projLen,
        y: projectedWorldUp.y / projLen,
        z: projectedWorldUp.z / projLen
      }
      
      // 计算cameraUp与projectedWorldUpNormalized之间的角度（在垂直于normal的平面内）
      // 使用点积计算夹角
      const cosRoll = Math.max(-1, Math.min(1, 
        cameraUp.x * projectedWorldUpNormalized.x +
        cameraUp.y * projectedWorldUpNormalized.y +
        cameraUp.z * projectedWorldUpNormalized.z
      ))
      
      // 使用叉积确定旋转方向（顺时针为正）
      const cross = {
        x: cameraUp.y * projectedWorldUpNormalized.z - cameraUp.z * projectedWorldUpNormalized.y,
        y: cameraUp.z * projectedWorldUpNormalized.x - cameraUp.x * projectedWorldUpNormalized.z,
        z: cameraUp.x * projectedWorldUpNormalized.y - cameraUp.y * projectedWorldUpNormalized.x
      }
      
      // 检查叉积与normal的方向是否一致（确定roll的正负）
      const dotWithNormal = cross.x * normal.x + cross.y * normal.y + cross.z * normal.z
      const sign = dotWithNormal > 0 ? 1 : -1
      
      roll = Math.acos(cosRoll) * (180 / Math.PI) * sign
      
      // 限制roll范围到-180到180度
      if (roll > 180) roll -= 360
      if (roll < -180) roll += 360
    }
  } else {
    // 如果normal接近垂直（与Y轴平行），roll无法定义，保持为0
    roll = 0
  }
  
  return {
    pitch: Number.isFinite(pitch) ? pitch : 0,
    yaw: Number.isFinite(yaw) ? yaw : 0,
    roll: Number.isFinite(roll) ? roll : 0,
  }
}

