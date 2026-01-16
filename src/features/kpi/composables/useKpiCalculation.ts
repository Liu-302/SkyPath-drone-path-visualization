import { ref } from 'vue'

interface KpiCalculationOptions {
  onStart?: () => Promise<void> | void
}

/**
 * KPI 计算状态管理
 * 负责处理加载状态、错误信息以及重试逻辑
 */
export function useKpiCalculation(options?: KpiCalculationOptions) {
  const isCalculating = ref(false)
  const hasError = ref(false)
  const calculationProgress = ref(0)
  const errorMessage = ref('')

  const setError = (message: string) => {
    hasError.value = true
    errorMessage.value = message
  }

  const clearError = () => {
    hasError.value = false
    errorMessage.value = ''
  }

  const startCalculation = async () => {
    if (isCalculating.value) return

    isCalculating.value = true
    hasError.value = false
    calculationProgress.value = 0

    try {
      await options?.onStart?.()
      calculationProgress.value = 100
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setError(message)
      console.error('KPI 计算失败:', error)
    } finally {
      isCalculating.value = false
    }
  }

  const retryCalculation = () => {
    clearError()
    startCalculation()
  }

  return {
    isCalculating,
    hasError,
    calculationProgress,
    errorMessage,
    startCalculation,
    retryCalculation,
    setError,
    clearError,
  }
}


