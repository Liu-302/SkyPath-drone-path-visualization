import { computed, type Ref, watch } from 'vue'
import {
  calculateWaypointDetail,
  calculateViewpointDetail,
  calculateRemainingBattery,
  calculateMinDistanceToObstacle,
} from '../services/kpi-calculator'
import type { Object3D } from 'three'

interface WaypointDetailsOptions {
  batteryCapacity: Ref<number>
  buildingModel?: Ref<Object3D | null>
}

// 缓存视点数据，避免频繁的昂贵计算
const viewpointCache = new Map<string, any>()

/**
 * 生成缓存键（含 position 与 normal，以便 Pitch/Yaw 变更或撤销/重做后正确刷新）
 */
function getCacheKey(
  index: number,
  point: { x: number; y: number; z: number; normal?: { x: number; y: number; z: number } }
): string {
  const n = point.normal
  const nx = n ? Math.round(n.x * 1000) : 0
  const ny = n ? Math.round(n.y * 1000) : 0
  const nz = n ? Math.round(n.z * 1000) : 0
  return `${index}-${Math.round(point.x)}-${Math.round(point.y)}-${Math.round(point.z)}-${nx}-${ny}-${nz}`
}

/**
 * 航点详情、视点数据、剩余电量与安全指标
 */
export function useWaypointDetails(
  parsedPoints: () => Array<{ x: number; y: number; z: number; normal?: { x: number; y: number; z: number } }>,
  selectedIndex: Ref<number | null>,
  options: WaypointDetailsOptions,
) {
  const getPoints = () => parsedPoints() || []

  // 路径变化时（如路径优化）清空缓存，确保每个航点的 KPI 重新计算
  watch(
    () => parsedPoints(),
    () => {
      viewpointCache.clear()
    },
    { flush: 'sync' }
  )

  // 监听当前航点的 position+normal 变化，清空相关缓存（使 Pitch/Yaw 撤销/重做后正确刷新）
  watch(
    () => {
      const index = selectedIndex.value
      if (index === null) return null
      const points = getPoints()
      if (index >= points.length) return null
      const point = points[index]
      return getCacheKey(index, point)
    },
    () => {
      viewpointCache.clear()
    }
  )

  const selectedWaypoint = computed(() => {
    const index = selectedIndex.value
    const points = getPoints()
    if (index === null || points.length <= index) return null

    try {
      return calculateWaypointDetail(index, points, options.batteryCapacity.value)
    } catch (error) {
      console.error('计算航点详情失败:', error)
      return null
    }
  })

  const viewpointData = computed(() => {
    const index = selectedIndex.value
    const points = getPoints()
    if (index === null || points.length <= index) {
      return {
        pitch: -45,
        yaw: 90,
        roll: 0,
        overlap: null,
      }
    }

    const currentPoint = points[index]

    // 检查缓存
    const cacheKey = getCacheKey(index, currentPoint)
    if (viewpointCache.has(cacheKey)) {
      return viewpointCache.get(cacheKey)
    }

    try {
      const result = calculateViewpointDetail(index, points, options.buildingModel?.value ?? null)

      // 更新缓存（限制缓存大小，最多保留 20 条）
      if (viewpointCache.size > 20) {
        const firstKey = viewpointCache.keys().next().value
        if (firstKey !== undefined) {
          viewpointCache.delete(firstKey)
        }
      }
      viewpointCache.set(cacheKey, result)

      return result
    } catch (error) {
      console.error('计算视点数据失败:', error)
      return {
        pitch: -45,
        yaw: 90,
        roll: 0,
        overlap: null,
      }
    }
  })

  const remainingBattery = computed(() => {
    const index = selectedIndex.value
    const points = getPoints()
    if (index === null || points.length === 0) {
      return 100
    }

    try {
      return calculateRemainingBattery(index, points, options.batteryCapacity.value)
    } catch (error) {
      console.error('计算剩余电池电量失败:', error)
      return 100
    }
  })

  const minDistanceToObstacle = computed(() => {
    const index = selectedIndex.value
    const points = getPoints()
    if (index === null || points.length === 0) {
      return null
    }

    try {
      return calculateMinDistanceToObstacle(index, points, options.buildingModel?.value ?? null)
    } catch (error) {
      console.error('计算到障碍物距离失败:', error)
      return null
    }
  })

  const safetyData = computed(() => ({
    remainingBattery: remainingBattery.value,
    minDistanceToObstacle: minDistanceToObstacle.value,
  }))

  return {
    selectedWaypoint,
    viewpointData,
    safetyData,
  }
}


