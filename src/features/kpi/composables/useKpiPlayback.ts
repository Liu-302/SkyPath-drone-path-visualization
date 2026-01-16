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
    console.log('play')
  }

  const handlePause = () => {
    isPaused.value = !isPaused.value
    console.log(isPaused.value ? 'pause' : 'resume')
  }

  const handleStop = () => {
    isPlaying.value = false
    isPaused.value = false
    console.log('stop')
  }

  const viewCoverage = () => {
    console.log('coverage')
  }

  const viewOverlap = () => {
    console.log('overlap')
  }

  const viewSafety = () => {
    console.log('safety')
  }

  return {
    isPlaying,
    isPaused,
    handlePlay,
    handlePause,
    handleStop,
    viewCoverage,
    viewOverlap,
    viewSafety,
  }
}


