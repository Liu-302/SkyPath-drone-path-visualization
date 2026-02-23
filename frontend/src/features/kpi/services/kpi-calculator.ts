/**
 * KPI 航点/视点详情计算服务
 * 覆盖率、重叠率、碰撞等核心 KPI 已迁移至后端，本文件仅保留航点详情、电池、安全距离等前端计算。
 */

import { distance3D } from '@/shared/utils/geometry'
import { ENERGY_CONFIG } from '@/shared/constants/constants'
import { calculateCameraAngleFromNormal } from '@/features/visualization/services/viewpoint-calculator'
import { Box3, Vector3 } from 'three'
import type { Object3D } from 'three'

/**
 * 单个航点的详细信息接口
 */
export interface WaypointDetail {
  /** 航点名称 */
  name: string
  /** X坐标（mm） */
  x: string
  /** Y坐标（mm） */
  y: string
  /** Z坐标（mm） */
  z: string
  /** 纬度（已废弃） */
  latitude?: string
  /** 经度（已废弃） */
  longitude?: string
  /** 海拔（mm）（已废弃） */
  altitude?: string
  /** 从起点到该航点的距离（km） */
  distanceFromStart: string
  /** 飞行速度（m/s） */
  speed: number
  /** 预计时间（分钟） */
  estimatedTime: string
  /** 当前航段长度（m） */
  segmentLength: string
}

/**
 * 视点数据接口
 */
export interface ViewpointDetail {
  /** 俯仰角（度） */
  pitch: number
  /** 偏航角（度） */
  yaw: number
  /** 翻滚角（度） */
  roll: number
  /** 与前一个航点的重叠率（%） */
  overlap: number | null
}

/**
 * 安全数据接口
 */
export interface SafetyData {
  /** 剩余电池电量（%） */
  remainingBattery: number
  /** 到障碍物的最小距离（m） */
  minDistanceToObstacle: number | null
}

/**
 * 计算单个航点的详细信息
 * @param waypointIndex 航点索引
 * @param pathPoints 所有路径点
 * @param batteryCapacity 电池容量（Wh）
 * @returns 航点详细信息
 */
export function calculateWaypointDetail(
  waypointIndex: number,
  pathPoints: Array<{ x: number; y: number; z: number }>,
  batteryCapacity: number = 89.2 // DJI Phantom 4 Pro 官方规格：89.2 Wh
): WaypointDetail {
  if (waypointIndex < 0 || waypointIndex >= pathPoints.length) {
    throw new Error('Invalid waypoint index')
  }

  const point = pathPoints[waypointIndex]
  const waypointName = `WP${(waypointIndex + 1).toString().padStart(2, '0')}`

  // 计算从起点到当前航点的距离（km）
  let distanceFromStart = 0
  for (let i = 1; i <= waypointIndex; i++) {
    distanceFromStart += distance3D(pathPoints[i - 1], pathPoints[i])
  }
  distanceFromStart = distanceFromStart / 1000 // 转换为km

  // 计算预计时间（分钟）
  const distanceMeters = distanceFromStart * 1000
  const totalSeconds = distanceMeters / ENERGY_CONFIG.speed
  const totalMinutes = totalSeconds / 60

  // 计算当前航段长度（m）
  let segmentLength = 0
  if (waypointIndex > 0) {
    segmentLength = distance3D(pathPoints[waypointIndex - 1], pathPoints[waypointIndex])
  }

  return {
    name: waypointName,
    x: Math.round(point.x).toString(),
    y: Math.round(point.y).toString(),
    z: Math.round(point.z).toString(),
    distanceFromStart: distanceFromStart.toFixed(2),
    speed: ENERGY_CONFIG.speed,
    estimatedTime: totalMinutes.toFixed(2),
    segmentLength: segmentLength.toFixed(0)
  }
}

/**
 * 计算剩余电池电量
 * @param waypointIndex 航点索引
 * @param pathPoints 所有路径点
 * @param batteryCapacity 电池容量（Wh）
 * @returns 剩余电池电量（%）
 */
export function calculateRemainingBattery(
  waypointIndex: number,
  pathPoints: Array<{ x: number; y: number; z: number }>,
  batteryCapacity: number = 89.2 // DJI Phantom 4 Pro 官方规格：89.2 Wh
): number {
  if (waypointIndex < 0) {
    return 100
  }

  // 计算从起点到当前航点的实际能耗（Wh）
  let totalEnergy = 0

  if (pathPoints.length > 1) {
    for (let i = 1; i <= waypointIndex && i < pathPoints.length; i++) {
      const prev = pathPoints[i - 1]
      const curr = pathPoints[i]

      // 计算距离
      const dx = curr.x - prev.x
      const dy = curr.y - prev.y
      const dz = curr.z - prev.z
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)

      // 基础功耗：距离 × 单位距离能耗
      const basePower = distance * ENERGY_CONFIG.powerPerMeter
      // 爬升功耗：高度差 × 爬升功耗系数
      const climbPower = Math.abs(dy) * ENERGY_CONFIG.climbPowerFactor

      totalEnergy += basePower + climbPower
    }
  }

  if (!totalEnergy || totalEnergy <= 0) {
    return 100
  }

  // 计算能耗百分比
  const energyPercent = (totalEnergy / batteryCapacity) * 100

  // 剩余电量计算：考虑多块电池的情况
  // 如果能耗是 120.5%，表示第一块电池用完，第二块电池用了 20.5%，剩余 79.5%
  // 如果能耗是 200.0%，表示前两块电池用完，第三块电池剩余 0%
  // 使用取模运算计算当前电池的剩余电量
  const currentBatteryUsage = energyPercent % 100  // 当前电池的使用百分比
  const remaining = 100 - currentBatteryUsage      // 当前电池的剩余百分比

  // 确保剩余电量在 0-100% 范围内，保留1位小数
  return Math.max(0, Math.min(100, Math.round(remaining * 10) / 10))
}

/**
 * 计算到障碍物的最小距离
 * @param waypointIndex 航点索引
 * @param pathPoints 所有路径点
 * @param buildingModel 建筑物模型
 * @returns 最小距离（m），如果无法计算返回null
 */
export function calculateMinDistanceToObstacle(
  waypointIndex: number,
  pathPoints: Array<{ x: number; y: number; z: number }>,
  buildingModel: Object3D | null
): number | null {
  if (waypointIndex < 0 || !buildingModel) {
    return null
  }

  if (waypointIndex >= pathPoints.length) {
    return null
  }

  const point = pathPoints[waypointIndex]
  const waypointPos = new Vector3(point.x, point.y, point.z)

  try {
    // 计算建筑物的包围盒
    const buildingBox = new Box3().setFromObject(buildingModel)

    if (buildingBox.isEmpty()) {
      return null
    }

    const { min, max } = buildingBox
    let minDistance: number

    // 判断航点是否在包围盒内部
    const isInside =
      waypointPos.x >= min.x && waypointPos.x <= max.x &&
      waypointPos.y >= min.y && waypointPos.y <= max.y &&
      waypointPos.z >= min.z && waypointPos.z <= max.z

    if (isInside) {
      // 在内部：到最近表面的距离 = 各轴到最近面的距离的最小值
      const distToX = Math.min(waypointPos.x - min.x, max.x - waypointPos.x)
      const distToY = Math.min(waypointPos.y - min.y, max.y - waypointPos.y)
      const distToZ = Math.min(waypointPos.z - min.z, max.z - waypointPos.z)
      minDistance = Math.min(distToX, distToY, distToZ)
    } else {
      // 在外部：到包围盒最近点的距离
      const clampedPoint = waypointPos.clone().clamp(min, max)
      minDistance = waypointPos.distanceTo(clampedPoint)
    }

    // 保留1位小数
    return Math.round(minDistance * 10) / 10
  } catch (error) {
    console.error('计算到障碍物距离失败:', error)
    return null
  }
}

/**
 * 计算视点数据（相机角度和重叠率）
 * @param waypointIndex 航点索引
 * @param pathPoints 所有路径点（包含normal向量）
 * @param buildingModel 建筑物模型
 * @returns 视点数据
 */
export function calculateViewpointDetail(
  waypointIndex: number,
  pathPoints: Array<{ x: number; y: number; z: number; normal?: { x: number; y: number; z: number } }>,
  buildingModel: Object3D | null
): ViewpointDetail {
  // 默认值
  const defaultPitch = -45
  const defaultYaw = 90
  const defaultRoll = 0 // Roll 已弃用，固定为 0
  let overlap: number | null = null

  if (waypointIndex < 0 || waypointIndex >= pathPoints.length) {
    return {
      pitch: defaultPitch,
      yaw: defaultYaw,
      roll: 0, // 固定为 0
      overlap: null
    }
  }

  const point = pathPoints[waypointIndex]

  // 与前一航点的重叠率：已迁移到后端（四棱锥 + 动态h + 航点normal），这里不再做本地计算
  // 面板展示将通过后端接口获取并显示
  overlap = null

  // 计算相机角度
  let pitch = defaultPitch
  let yaw = defaultYaw
  // Roll 已弃用，固定为 0

  if (point.normal && typeof point.normal === 'object') {
    const normal = {
      x: point.normal.x ?? 0,
      y: point.normal.y ?? 0,
      z: point.normal.z ?? 0
    }

    const normalLength = Math.sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z)
    if (normalLength > 0.001) {
      const normalizedNormal = {
        x: normal.x / normalLength,
        y: normal.y / normalLength,
        z: normal.z / normalLength
      }

      const angles = calculateCameraAngleFromNormal(normalizedNormal)
      pitch = Math.round(angles.pitch * 10) / 10
      yaw = Math.round(angles.yaw * 10) / 10
      // Roll 固定为 0
    }
  }

  return {
    pitch,
    yaw,
    roll: 0, // 固定为 0
    overlap: overlap !== null ? Math.round(overlap * 10) / 10 : null
  }
}
