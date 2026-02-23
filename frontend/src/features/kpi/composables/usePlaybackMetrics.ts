import { ref, computed, watch } from 'vue'
import { useDatasetStore } from '@/stores/dataset'
import { distance3D } from '@/shared/utils/geometry'
import { ENERGY_CONFIG } from '@/shared/constants/constants'

type PathPoint = { x: number; y: number; z: number; normal?: { x: number; y: number; z: number }; id?: number }

export function usePlaybackMetrics(
  getParsedPoints: () => PathPoint[],
  getFetchPlaybackCoverage?: () => ((waypointCount: number) => Promise<number | null>) | undefined,
) {
  const store = useDatasetStore()
  const cumulativeCoverageCache = ref<number | null>(null)
  const lastComputedWaypointIndex = ref<number>(-1)

  const waypointCount = computed(() => getParsedPoints().length)

  const totalDistance = computed(() => {
    const pts = getParsedPoints()
    if (pts.length < 2) return 0
    let d = 0
    for (let i = 1; i < pts.length; i++) {
      d += distance3D(pts[i - 1], pts[i])
    }
    return d
  })

  const totalMissionTimeSeconds = computed(() => {
    if (totalDistance.value <= 0) return 0
    return totalDistance.value / (ENERGY_CONFIG.speed || 5)
  })
  /** 总时长 = 任务时长（24min），不随倍速改变；倍速只影响实际播放时间 */
  const totalTimeSeconds = computed(() => totalMissionTimeSeconds.value)

  const segmentDistances = computed(() => {
    const pts = getParsedPoints()
    const segs: number[] = [0]
    for (let i = 1; i < pts.length; i++) {
      segs.push(segs[i - 1] + distance3D(pts[i - 1], pts[i]))
    }
    return segs
  })

  function indexToMissionTime(idx: number, segs: number[], totalDist: number, totalTime: number): number {
    if (totalDist <= 0 || totalTime <= 0) return 0
    const i0 = Math.floor(idx)
    const i1 = Math.min(i0 + 1, segs.length - 1)
    const alpha = idx - i0
    const dist = segs[i0] + alpha * (segs[i1] - segs[i0])
    return (dist / totalDist) * totalTime
  }

  /** 已用时间 = 任务进度（0~24min），与总时长一致，不随倍速改变 */
  const usedTimeSeconds = computed(() => {
    const pts = getParsedPoints()
    if (pts.length < 2) return 0
    const segs = segmentDistances.value
    const totalDist = totalDistance.value
    const totalTime = totalMissionTimeSeconds.value
    return indexToMissionTime(store.playbackIndex, segs, totalDist, totalTime)
  })

  const flownDistance = computed(() => {
    const idx = store.playbackIndex
    const pts = getParsedPoints()
    if (pts.length < 2) return 0
    const segs = segmentDistances.value
    const i0 = Math.floor(idx)
    const i1 = Math.min(i0 + 1, pts.length - 1)
    if (i0 >= pts.length - 1) return totalDistance.value
    const alpha = idx - i0
    return segs[i0] + alpha * (segs[i1] - segs[i0])
  })

  async function recomputeCumulativeCoverage(targetFloorIdx?: number) {
    const pts = getParsedPoints()
    const floorIdx = targetFloorIdx ?? Math.floor(store.playbackIndex)
    if (pts.length === 0) {
      cumulativeCoverageCache.value = 0
      lastComputedWaypointIndex.value = floorIdx
      return
    }
    if (floorIdx < 0) {
      cumulativeCoverageCache.value = 0
      lastComputedWaypointIndex.value = floorIdx
      return
    }
    // 累计覆盖率 = 到达当前航点时的覆盖率（含当前点），waypointCount = floorIdx + 1
    const fetchBackend = getFetchPlaybackCoverage?.()
    if (fetchBackend) {
      try {
        const waypointCount = floorIdx + 1
        const coverage = await fetchBackend(waypointCount)
        if (Math.floor(store.playbackIndex) !== floorIdx) return
        cumulativeCoverageCache.value = coverage != null ? (Number.isFinite(coverage) ? coverage : 0) : null
        lastComputedWaypointIndex.value = floorIdx
      } catch (e) {
        if (Math.floor(store.playbackIndex) !== floorIdx) return
        console.warn('[usePlaybackMetrics] Backend coverage failed:', e)
        cumulativeCoverageCache.value = null
      }
      return
    }
    cumulativeCoverageCache.value = null
    lastComputedWaypointIndex.value = floorIdx
  }

  /** 覆盖率在预加载时已全部算好，播放时仅从缓存读取，无计算开销 */
  watch(
    () => [store.playbackIndex, store.isPlaybackMode] as const,
    ([idx, isPlaying]) => {
      if (!isPlaying) return
      const floorIdx = Math.floor(idx)
      if (floorIdx !== lastComputedWaypointIndex.value) {
        recomputeCumulativeCoverage(floorIdx)
      }
    },
    { immediate: true },
  )

  const playbackMetrics = computed(() => ({
    cumulativeCoverage: cumulativeCoverageCache.value,
    flownDistance: flownDistance.value,
    usedTimeSeconds: usedTimeSeconds.value,
    totalDistance: totalDistance.value,
    totalTimeSeconds: totalTimeSeconds.value,
  }))

  return {
    playbackMetrics,
    recomputeCumulativeCoverage,
  }
}
