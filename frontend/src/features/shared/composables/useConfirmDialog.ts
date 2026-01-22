import { ref } from 'vue'

/**
 * 确认对话框 Composable
 * 负责管理确认对话框的状态和逻辑
 */
export function useConfirmDialog() {
  const dialogVisible = ref(false)
  const dialogMessage = ref('')
  let dialogResolve: ((value: boolean) => void) | null = null

  /**
   * 显示确认对话框
   */
  const showConfirmDialog = (message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      dialogMessage.value = message
      dialogVisible.value = true
      dialogResolve = resolve
    })
  }

  /**
   * 处理确认
   */
  const handleConfirm = () => {
    if (dialogResolve) {
      dialogResolve(true)
      dialogResolve = null
      dialogVisible.value = false
    }
  }

  /**
   * 处理取消
   */
  const handleCancel = () => {
    if (dialogResolve) {
      dialogResolve(false)
      dialogResolve = null
      dialogVisible.value = false
    }
  }

  return {
    dialogVisible,
    dialogMessage,
    showConfirmDialog,
    handleConfirm,
    handleCancel
  }
}

