/**
 * KPI计算主服务
 *
 * 参考 `kpi_calculation_with_real_data.js` 的实现方式，串联路径长度、
 * 覆盖率、能耗、碰撞等核心指标的科学算法。
 */

import type { KPIMetrics, KPICalcParams, CollisionPoint } from '@/features/kpi/types/kpi'
import { distance3D } from '@/shared/utils/geometry'
import { coverageCalculator } from './coverage-calculator'
import { energyCalculator } from './energy-calculator'
import { collisionDetector } from './collision-detector'
import { ENERGY_CONFIG, CAMERA_CONFIG } from '@/shared/constants/constants'
import { calculateCameraAngleFromNormal } from '@/features/visualization/services/viewpoint-calculator'
import { calculateFrustumCorners, getVisibleMeshFaces, calculateFaceArea, calculateTotalBuildingArea, calculateCameraOrientationFromNormal } from '@/shared/utils/camera-utils'
import { Box3, Vector3, Mesh } from 'three'
import type { Object3D } from 'three'

let calculationStatus: 'idle' | 'calculating' | 'completed' | 'error' = 'idle'
let calculationProgress = 0
let cancellationRequested = false

export async function calculateAllKPIs(params: KPICalcParams): Promise<KPIMetrics> {
  const { pathPoints, buildingMesh, options = {} } = params
  if (!pathPoints || pathPoints.length < 2) {
    throw new Error('缺少有效的路径点数据，无法计算KPI')
  }

  calculationStatus = 'calculating'
  calculationProgress = 0
  cancellationRequested = false

  const totalSteps = buildingMesh ? 6 : 4
  let currentStep = 0
  const advance = async () => {
    currentStep += 1
    calculationProgress = Math.min(100, Math.round((currentStep / totalSteps) * 100))
    // 每次都让出主线程，避免阻塞UI
    await new Promise(resolve => setTimeout(resolve, 5))
  }

  try {
    ensureNotCancelled()
    const pathLength = calculatePathLength(pathPoints)
    await advance()

    ensureNotCancelled()
    const flightTime = calculateFlightTime(pathLength)
    await advance()

    ensureNotCancelled()
    const energy = energyCalculator.calculatePathEnergy(pathPoints)
    await advance()

    let coverage: number | null = null
    let overlap: number | null = null
    if (buildingMesh) {
      try {
        // 在计算覆盖率前让出主线程
        await new Promise(resolve => setTimeout(resolve, 10))
        const coverageMetrics = coverageCalculator.calculatePathCoverageMetrics(pathPoints, buildingMesh)
        coverage = clamp01(coverageMetrics.coverage / 100)
        overlap = clamp01(coverageMetrics.overlap / 100)
      } catch (error) {
        console.error('覆盖率计算失败:', error)
        // 计算失败时保持null，不设为0
        coverage = null
        overlap = null
      }
    }
    // 如果没有建筑模型，coverage和overlap保持为null，表示无法计算
    await advance()

    // 给主线程更多时间处理UI
    await new Promise(resolve => setTimeout(resolve, 20))

    ensureNotCancelled()
    const collisionResult = buildingMesh
      ? collisionDetector.detectPathCollisions(pathPoints, buildingMesh)
      : { collisionCount: 0, hasCollision: false, collisions: [] as CollisionPoint[] }
    await advance()

    const metrics: KPIMetrics = {
      pathLength,
      flightTime,
      coverage,
      overlap,
      collisionCount: collisionResult.collisionCount,
      hasCollision: collisionResult.hasCollision,
      energy,
      status: 'completed',
      progress: 100,
    }

    if (options.includeCollisionDetails) {
      metrics.collisionDetails = collisionResult.collisions
    }

    calculationStatus = 'completed'
    calculationProgress = 100

    return metrics
  } catch (error) {
    calculationStatus = 'error'
    calculationProgress = 0
    throw error
  } finally {
    cancellationRequested = false
  }
}

export function getCalculationProgress(): number {
  return calculationProgress
}

export function cancelCalculation(): void {
  cancellationRequested = true
}

export function getCalculationStatus(): 'idle' | 'calculating' | 'completed' | 'error' {
  return calculationStatus
}

export function calculateSingleViewpointMetrics(pathPoints: KPICalcParams['pathPoints'], currentIndex: number) {
  if (!pathPoints?.length || currentIndex < 0 || currentIndex >= pathPoints.length) {
    throw new Error('视点索引无效')
  }

  const currentPoint = pathPoints[currentIndex]
  const startPoint = pathPoints[0]
  const prevPoint = currentIndex > 0 ? pathPoints[currentIndex - 1] : null

  const distanceFromStart = distance3D(startPoint.position, currentPoint.position)
  const flightTimeToCurrent = calculateCumulativeTime(pathPoints, currentIndex)
  const distanceToPrev = prevPoint ? distance3D(prevPoint.position, currentPoint.position) : 0
  const singlePointCoverage = calculateSinglePointCoverage(pathPoints, currentIndex)
  const singlePointOverlap = calculateSinglePointOverlap(pathPoints, currentIndex)
  const cameraAngle = calculateCameraAngle(currentPoint.normal)

  return {
    position: { ...currentPoint.position },
    distanceFromStart: round2(distanceFromStart),
    flightTimeToCurrent: round2(flightTimeToCurrent),
    distanceToPrev: round2(distanceToPrev),
    singlePointCoverage: round2(singlePointCoverage * 100),
    singlePointOverlap: round2(singlePointOverlap * 100),
    cameraAngle: round2(cameraAngle),
  }
}

function calculatePathLength(pathPoints: KPICalcParams['pathPoints']): number {
  let totalDistance = 0
  for (let i = 1; i < pathPoints.length; i++) {
    totalDistance += distance3D(pathPoints[i - 1].position, pathPoints[i].position)
  }
  return totalDistance
}

function calculateFlightTime(pathLength: number): number {
  return pathLength / ENERGY_CONFIG.speed
}

function calculateCumulativeTime(pathPoints: KPICalcParams['pathPoints'], currentIndex: number): number {
  let totalTime = 0
  for (let i = 1; i <= currentIndex; i++) {
    const segmentLength = distance3D(pathPoints[i - 1].position, pathPoints[i].position)
    totalTime += segmentLength / ENERGY_CONFIG.speed
  }
  return totalTime
}

function calculateSinglePointCoverage(pathPoints: KPICalcParams['pathPoints'], currentIndex: number): number {
  const currentPoint = pathPoints[currentIndex]
  const coverageRadius = 15
  let coveredPoints = 0

  for (let i = 0; i < pathPoints.length; i++) {
    if (i === currentIndex) continue
    const distance = distance3D(currentPoint.position, pathPoints[i].position)
    if (distance <= coverageRadius) {
      coveredPoints += 1
    }
  }

  return clamp01(coveredPoints / Math.max(1, pathPoints.length - 1))
}

function calculateSinglePointOverlap(pathPoints: KPICalcParams['pathPoints'], currentIndex: number): number {
  const currentPoint = pathPoints[currentIndex]
  const overlapRadius = 10
  let overlapSum = 0
  let overlapCount = 0

  for (let i = 0; i < pathPoints.length; i++) {
    if (i === currentIndex) continue
    const distance = distance3D(currentPoint.position, pathPoints[i].position)
    if (distance < overlapRadius) {
      overlapSum += 1 - distance / overlapRadius
      overlapCount += 1
    }
  }

  return clamp01(overlapCount > 0 ? overlapSum / overlapCount : 0)
}

function calculateCameraAngle(normal?: { x: number; y: number; z: number }): number {
  if (!normal) return 0
  const verticalAngle = Math.acos(Math.min(1, Math.abs(normal.y)))
  return (verticalAngle * 180) / Math.PI
}

function ensureNotCancelled() {
  if (cancellationRequested) {
    throw new Error('KPI计算已被取消')
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

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
    throw new Error('航点索引无效')
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

    // 计算点到包围盒的最小距离
    const clampedPoint = waypointPos.clone().clamp(buildingBox.min, buildingBox.max)
    const minDistance = waypointPos.distanceTo(clampedPoint)

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

  // 计算与前一个航点的重叠率
  if (waypointIndex > 0 && buildingModel) {
    try {
      const meshes = extractMeshes(buildingModel)
      if (meshes.length === 0) {
        throw new Error('buildingModel 中未找到可用 Mesh')
      }

      // 构建视点数据数组（从起点到当前航点）
      const viewpoints = []
      for (let i = 0; i <= waypointIndex; i++) {
        const p = pathPoints[i]
        if (p) {
          // 获取相机朝向
          let direction = { x: 0, y: -1, z: 0 } // 默认向下
          if (p.normal && typeof p.normal === 'object') {
            const normal = {
              x: p.normal.x ?? 0,
              y: p.normal.y ?? 0,
              z: p.normal.z ?? 0
            }
            const normalLength = Math.sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z)
            if (normalLength > 0.001) {
              direction = {
                x: normal.x / normalLength,
                y: normal.y / normalLength,
                z: normal.z / normalLength
              }
            }
          }

          viewpoints.push({
            position: { x: p.x, y: p.y, z: p.z },
            direction,
            fov: CAMERA_CONFIG.fov,
            aspect: CAMERA_CONFIG.aspect,
            near: CAMERA_CONFIG.near,
            far: CAMERA_CONFIG.far
          })
        }
      }

      // 计算当前航点与前一个航点的重叠率
      if (viewpoints.length > 1) {
        const currentViewpoint = viewpoints[waypointIndex]
        const previousViewpoint = viewpoints[waypointIndex - 1]

        // 计算当前视点的视锥体
        const { up: currentUp } = calculateCameraOrientationFromNormal(currentViewpoint.direction)
        const currentFrustum = calculateFrustumCorners(
          currentViewpoint.position,
          currentViewpoint.direction,
          currentUp,
          currentViewpoint.fov,
          currentViewpoint.aspect,
          currentViewpoint.near,
          currentViewpoint.far
        )
        const { up: prevUp } = calculateCameraOrientationFromNormal(previousViewpoint.direction)
        const prevFrustum = calculateFrustumCorners(
          previousViewpoint.position,
          previousViewpoint.direction,
          prevUp,
          previousViewpoint.fov,
          previousViewpoint.aspect,
          previousViewpoint.near,
          previousViewpoint.far
        )

        let intersectionArea = 0
        let totalArea = 0

        for (const mesh of meshes) {
          const currentVisibleFaces = new Set(getVisibleMeshFaces(currentFrustum, mesh))
          const prevVisibleFaces = new Set(getVisibleMeshFaces(prevFrustum, mesh))

          for (const faceIndex of currentVisibleFaces) {
            if (prevVisibleFaces.has(faceIndex)) {
              intersectionArea += calculateFaceArea(mesh, faceIndex)
            }
          }

          totalArea += calculateTotalBuildingArea(mesh)
        }

        if (totalArea > 0) {
          overlap = (intersectionArea / totalArea) * 100
        } else {
          overlap = 0
        }
      }
    } catch (error) {
      console.error('计算重叠率失败:', error)
      overlap = null
    }
  }

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

function extractMeshes(model: Object3D | null): Mesh[] {
  const meshes: Mesh[] = []
  if (!model) return meshes

  if (typeof model.traverse === 'function') {
    model.traverse(child => {
      const candidate = child as Mesh
      if ((candidate as any).isMesh) {
        meshes.push(candidate)
      }
    })
  } else if ((model as any).isMesh) {
    meshes.push(model as Mesh)
  }

  return meshes
}
