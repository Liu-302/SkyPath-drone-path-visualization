import { ref } from 'vue'

/**
 * 加载进度管理 Composable
 * 负责管理加载进度和动画
 */
export function useLoadingProgress() {
  const loadingProgress = ref(0)
  const loading = ref(false)

  /**
   * 平滑更新进度
   */
  const smoothProgress = async (
    targetProgress: number,
    duration: number = 300
  ) => {
    const startProgress = loadingProgress.value
    const diff = targetProgress - startProgress
    
    if (diff <= 0) {
      loadingProgress.value = Math.round(targetProgress)
      return
    }
    
    const steps = 20
    const stepDuration = duration / steps
    const stepIncrement = diff / steps
    
    for (let i = 0; i < steps; i++) {
      await new Promise(resolve => setTimeout(resolve, stepDuration))
      const currentProgress = startProgress + stepIncrement * (i + 1)
      loadingProgress.value = Math.round(Math.min(targetProgress, currentProgress))
    }
    loadingProgress.value = Math.round(targetProgress)
  }

  /**
   * 设置加载状态
   */
  const setLoading = (value: boolean) => {
    loading.value = value
    if (!value) {
      loadingProgress.value = 0
    }
  }

  /**
   * 重置进度
   */
  const resetProgress = () => {
    loadingProgress.value = 0
  }

  return {
    loadingProgress,
    loading,
    smoothProgress,
    setLoading,
    resetProgress
  }
}

