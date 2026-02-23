import { ref } from 'vue'

/**
 * 确认对话框 Composable
 * 负责管理确认对话框的状态和逻辑
 */
export interface ConfirmDialogOptions {
  showCancel?: boolean
  confirmLabel?: string
}

export function useConfirmDialog() {
  const dialogVisible = ref(false)
  const dialogMessage = ref('')
  const dialogShowCancel = ref(true)
  const dialogConfirmLabel = ref('Confirm')
  let dialogResolve: ((value: boolean) => void) | null = null

  /**
   * 显示确认对话框
   */
  const showConfirmDialog = (message: string, options?: ConfirmDialogOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      dialogMessage.value = message
      dialogShowCancel.value = options?.showCancel ?? true
      dialogConfirmLabel.value = options?.confirmLabel ?? 'Confirm'
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
    dialogShowCancel,
    dialogConfirmLabel,
    showConfirmDialog,
    handleConfirm,
    handleCancel
  }
}

