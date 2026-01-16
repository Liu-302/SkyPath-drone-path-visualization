import { computed, type Ref } from 'vue'
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

/**
 * 航点详情、视点数据、剩余电量与安全指标
 */
export function useWaypointDetails(
  parsedPoints: () => Array<{ x: number; y: number; z: number; normal?: { x: number; y: number; z: number } }>,
  selectedIndex: Ref<number | null>,
  options: WaypointDetailsOptions,
) {
  const getPoints = () => parsedPoints() || []

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

    try {
      return calculateViewpointDetail(index, points, options.buildingModel?.value ?? null)
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


