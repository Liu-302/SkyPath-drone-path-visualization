import { ref, computed } from 'vue'
import { useDatasetStore } from '@/stores/dataset'

/**
 * 文件上传 Composable
 * 负责处理文件选择、拖拽、删除等逻辑
 */
interface FileUploadOptions {
  onAfterAdd?: (file: File) => Promise<void> | void
}

export function useFileUpload(
  acceptPattern: RegExp,
  fileType: 'model' | 'path',
  onConfirmReplace?: (currentFile: string, newFile: string) => Promise<boolean>,
  options?: FileUploadOptions
) {
  const store = useDatasetStore()
  const isDrag = ref(false)
  const errorMsg = ref('')
  const okMsg = ref('')

  // 获取对应的文件列表
  const selectedFiles = computed(() => {
    return fileType === 'model' ? store.modelFiles : store.pathFiles
  })

  /**
   * 处理文件选择
   */
  const handleFileSelect = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return

    const acceptedFiles = Array.from(fileList).filter(f => acceptPattern.test(f.name))
    
    if (acceptedFiles.length === 0) {
      const fileTypeName = fileType === 'model' ? 'OBJ' : 'JSON'
      errorMsg.value = `Only .${fileTypeName.toLowerCase()} format files are accepted`
      return
    }

    const newFile = acceptedFiles[0]
    const currentFiles = selectedFiles.value

    // 如果已有文件，询问是否替换
    if (currentFiles.length > 0) {
      const currentFile = currentFiles[0].name
      const confirmed = onConfirmReplace 
        ? await onConfirmReplace(currentFile, newFile.name)
        : true

      if (confirmed) {
        // 替换文件
        if (fileType === 'model') {
          console.log(`[模型] 已替换: ${currentFile} → ${newFile.name}`)
          store.removeModelFile(currentFile)
          store.addModelFiles([newFile])
        } else {
          console.log(`[路径] 已替换: ${currentFile} → ${newFile.name}`)
          store.removePathFile(currentFile)
          store.addPathFiles([newFile])
        }
        okMsg.value = ''
        await options?.onAfterAdd?.(newFile)
      } else {
        return // 用户取消替换
      }
    } else {
      // 没有文件，直接添加
      if (fileType === 'model') {
        console.log(`[模型] 已导入: ${newFile.name} (${(newFile.size / 1024).toFixed(2)} KB)`)
        store.addModelFiles([newFile])
      } else {
        console.log(`[路径] 已导入: ${newFile.name} (${(newFile.size / 1024).toFixed(2)} KB)`)
        store.addPathFiles([newFile])
      }
      await options?.onAfterAdd?.(newFile)
    }
  }

  /**
   * 处理文件拖拽
   */
  const handleFileDrop = async (e: DragEvent) => {
    const droppedFiles = Array.from(e.dataTransfer?.files || [])
    const acceptedFiles = droppedFiles.filter(f => acceptPattern.test(f.name))
    
    if (acceptedFiles.length === 0) {
      const fileTypeName = fileType === 'model' ? 'OBJ' : 'JSON'
      errorMsg.value = `Only .${fileTypeName.toLowerCase()} format files are accepted`
      isDrag.value = false
      return
    }

    const newFile = acceptedFiles[0]
    const currentFiles = selectedFiles.value

    // 如果已有文件，询问是否替换
    if (currentFiles.length > 0) {
      const currentFile = currentFiles[0].name
      const confirmed = onConfirmReplace
        ? await onConfirmReplace(currentFile, newFile.name)
        : true

      if (confirmed) {
        // 替换文件
        if (fileType === 'model') {
          console.log(`[模型] 已替换: ${currentFile} → ${newFile.name}`)
          store.removeModelFile(currentFile)
          store.addModelFiles([newFile])
        } else {
          console.log(`[路径] 已替换: ${currentFile} → ${newFile.name}`)
          store.removePathFile(currentFile)
          store.addPathFiles([newFile])
        }
        okMsg.value = ''
        await options?.onAfterAdd?.(newFile)
      } else {
        isDrag.value = false
        return // 用户取消替换
      }
    } else {
      // 没有文件，直接添加
      if (fileType === 'model') {
        console.log(`[模型] 已导入: ${newFile.name} (${(newFile.size / 1024).toFixed(2)} KB)`)
        store.addModelFiles([newFile])
      } else {
        console.log(`[路径] 已导入: ${newFile.name} (${(newFile.size / 1024).toFixed(2)} KB)`)
        store.addPathFiles([newFile])
      }
      await options?.onAfterAdd?.(newFile)
    }

    isDrag.value = false
  }

  /**
   * 删除文件
   */
  const removeFile = (name: string) => {
    if (fileType === 'model') {
      store.removeModelFile(name)
    } else {
      store.removePathFile(name)
      store.setParsedPoints([])
    }
  }

  /**
   * 清除消息
   */
  const clearMessages = () => {
    errorMsg.value = ''
    okMsg.value = ''
  }

  return {
    isDrag,
    errorMsg,
    okMsg,
    files: selectedFiles,
    handleFileSelect,
    handleFileDrop,
    removeFile,
    clearMessages
  }
}

