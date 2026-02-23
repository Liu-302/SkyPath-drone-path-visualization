import { ref, onMounted, onUnmounted, watch } from 'vue'

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
    }
  }

  const selectWaypointManually = (index: number) => {
    handleWaypointSelect(index)
  }

  // 校验当前选中的索引是否在有效范围内
  const validateSelectedIndex = () => {
    if (selectedWaypointIndex.value !== null) {
      const count = totalWaypoints()
      if (selectedWaypointIndex.value >= count) {
        // 如果选中的索引超出范围，清除选中状态
        console.warn(`[useWaypointSelection] 选中的索引 ${selectedWaypointIndex.value} 超出范围，清除选中状态`)
        selectedWaypointIndex.value = null
      }
    }
  }

  onMounted(() => {
    const waypointSelectedHandler = (event: any) => {
      if (event.detail && event.detail.index !== undefined) {
        handleWaypointSelect(event.detail.index)
      }
    }

    const waypointDeselectedHandler = () => {
      selectedWaypointIndex.value = null
    }

    const waypointsChangedHandler = () => {
      // 航点数量变化时，校验当前选中的索引是否仍然有效
      validateSelectedIndex()
    }

    window.addEventListener('waypoint-selected', waypointSelectedHandler)
    window.addEventListener('waypoint-deselected', waypointDeselectedHandler)
    window.addEventListener('waypoints-changed', waypointsChangedHandler)
    window.selectWaypoint = selectWaypointManually

    onUnmounted(() => {
      window.removeEventListener('waypoint-selected', waypointSelectedHandler)
      window.removeEventListener('waypoint-deselected', waypointDeselectedHandler)
      window.removeEventListener('waypoints-changed', waypointsChangedHandler)
      if (window.selectWaypoint === selectWaypointManually) {
        delete window.selectWaypoint
      }
    })
  })

  // 监听航点数量变化，校验选中索引的有效性
  watch(
    () => totalWaypoints(),
    () => {
      validateSelectedIndex()
    }
  )

  return {
    selectedWaypointIndex,
    handleWaypointSelect,
    selectWaypointManually,
    validateSelectedIndex,
  }
}

declare global {
  interface Window {
    selectWaypoint?: (index: number) => void
  }
}


