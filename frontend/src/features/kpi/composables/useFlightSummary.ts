import { computed, type Ref } from 'vue'
import { ENERGY_CONFIG } from '@/shared/constants/constants'
import { distance3D } from '@/shared/utils/geometry'

type KpiMetrics = {
  pathLength?: number
  flightTime?: number
  energy?: number
  coverage?: number | null
  overlap?: number | null
  hasCollision?: boolean
}

type PathPoint = {
  x: number
  y: number
  z: number
}

/**
 * 飞行概览 / 能耗逻辑
 */
export function useFlightSummary(
  getParsedPoints: () => PathPoint[],
  getKpiMetrics: () => KpiMetrics | null | undefined,
  batteryCapacity: Ref<number>,
) {
  const datasetPathLength = computed(() => calculatePathLength(getParsedPoints()))

  const fallbackFlightTime = computed(() => {
    if (!datasetPathLength.value) return 0
    return datasetPathLength.value / (ENERGY_CONFIG.speed || 1)
  })

  const flightData = computed(() => {
    const metrics = getKpiMetrics()
    const totalDistanceMeters = metrics?.pathLength ?? datasetPathLength.value
    const flightTimeSeconds = metrics?.flightTime ?? fallbackFlightTime.value
    const energyValue = metrics?.energy ?? estimateEnergyFromPath(datasetPathLength.value)
    const coverageValue = metrics?.coverage ?? null
    const overlapValue = metrics?.overlap ?? null
    const hasCollision = metrics?.hasCollision ?? false

    const energyKwh = energyValue ? (energyValue / 1000).toFixed(2) : '0.00'
    const energyPercent = formatEnergyPercent(energyValue, batteryCapacity.value)

    return {
      totalDistance: totalDistanceMeters ? (totalDistanceMeters / 1000).toFixed(2) : '0.00',
      waypointCount: getParsedPoints().length,
      missionDuration: flightTimeSeconds ? (flightTimeSeconds / 60).toFixed(1) : '0.0',
      energyConsumption: energyPercent,
      energyKwh,
      coverageRate: coverageValue !== null ? (coverageValue * 100).toFixed(1) : 'N/A',
      overlapRate: overlapValue !== null ? (overlapValue * 100).toFixed(1) : 'N/A',
      safetyStatus: hasCollision ? 'Collision Risk' : 'Safe Flight',
    }
  })

  const safetyStatusClass = computed(() => {
    return flightData.value.safetyStatus.includes('Risk') ? 'status-warning' : 'status-safe'
  })

  return {
    flightData,
    safetyStatusClass,
    datasetPathLength,
  }
}

function calculatePathLength(points: PathPoint[]): number {
  if (!points || points.length < 2) return 0
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += distance3D(points[i - 1], points[i])
  }
  return total
}

function estimateEnergyFromPath(pathLength: number): number {
  if (!pathLength) return 0
  return pathLength * ENERGY_CONFIG.powerPerMeter
}

function formatEnergyPercent(energyValue: number, capacity: number): string {
  if (!energyValue || energyValue <= 0 || !capacity) return '0%'
  const percentage = (energyValue / capacity) * 100
  return `${percentage.toFixed(1)}%`
}


