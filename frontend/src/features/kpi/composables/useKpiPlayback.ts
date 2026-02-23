import { ref } from 'vue'

/**
 * KPI 播放/查看动作控制
 */
export function useKpiPlayback() {
  const isPlaying = ref(false)
  const isPaused = ref(false)

  const handlePlay = () => {
    isPlaying.value = true
    isPaused.value = false
  }

  const handlePause = () => {
    isPaused.value = !isPaused.value
  }

  const handleStop = () => {
    isPlaying.value = false
    isPaused.value = false
  }

  const viewCoverage = () => {
  }

  return {
    isPlaying,
    isPaused,
    handlePlay,
    handlePause,
    handleStop,
    viewCoverage,
  }
}


