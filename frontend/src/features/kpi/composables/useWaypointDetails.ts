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
 * 生成缓存键
 */
function getCacheKey(index: number, position: { x: number; y: number; z: number }): string {
  return `${index}-${Math.round(position.x)}-${Math.round(position.y)}-${Math.round(position.z)}`
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

  // 监听路径点变化，清空相关缓存
  watch(
    () => {
      const index = selectedIndex.value
      if (index === null) return null
      const points = getPoints()
      if (index >= points.length) return null
      const point = points[index]
      return `${index}-${Math.round(point.x)}-${Math.round(point.y)}-${Math.round(point.z)}`
    },
    (newKey) => {
      if (newKey) {
        // 当坐标变化时，清空旧缓存
        viewpointCache.clear()
      }
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


