import { ref, onMounted, onUnmounted } from 'vue'

/**
 * KPI 航点选择逻辑
 * 负责监听全局事件并维护当前航点索引
 */
export function useWaypointSelection(totalWaypoints: () => number) {
  const selectedWaypointIndex = ref<number | null>(null)

  const handleWaypointSelect = (index: number | null) => {
    if (index === null) {
      selectedWaypointIndex.value = null
      return
    }

    const count = totalWaypoints()
    if (index >= 0 && index < count) {
      selectedWaypointIndex.value = index
      console.log(`选择了航点 WP${(index + 1).toString().padStart(2, '0')}`)
    }
  }

  const selectWaypointManually = (index: number) => {
    handleWaypointSelect(index)
  }

  onMounted(() => {
    const waypointSelectedHandler = (event: any) => {
      if (event.detail && event.detail.index !== undefined) {
        handleWaypointSelect(event.detail.index)
      }
    }

    window.addEventListener('waypoint-selected', waypointSelectedHandler)
    window.selectWaypoint = selectWaypointManually

    onUnmounted(() => {
      window.removeEventListener('waypoint-selected', waypointSelectedHandler)
      if (window.selectWaypoint === selectWaypointManually) {
        delete window.selectWaypoint
      }
    })
  })

  return {
    selectedWaypointIndex,
    handleWaypointSelect,
    selectWaypointManually,
  }
}

declare global {
  interface Window {
    selectWaypoint?: (index: number) => void
  }
}


