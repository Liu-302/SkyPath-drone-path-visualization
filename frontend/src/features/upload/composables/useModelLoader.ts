import { ref, markRaw } from 'vue'
import { OBJLoader } from 'three-stdlib'
import * as THREE from 'three'
import type { Object3D } from 'three'
import BackendModelService from '@/shared/services/backendModelService'

/**
 * 模型加载 Composable
 * 负责加载和处理 OBJ 模型文件
 * 支持前端本地解析和后端API解析两种模式
 */
export function useModelLoader() {
  const buildingModel = ref<Object3D | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  /** 是否使用后端模式(默认true) */
  const useBackend = ref(true)

  /**
   * 读取文件为文本
   */
  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsText(file)
    })
  }

  /**
   * 使用后端API加载OBJ模型
   */
  const loadObjModelFromBackend = async (file: File, projectId: string = '1'): Promise<Object3D> => {
    console.log('[后端模式] 开始加载OBJ模型...')

    // 上传文件到后端并获取优化数据
    const modelData = await BackendModelService.uploadOBJ(file, projectId)

    // 从后端数据创建Three.js对象
    const model = BackendModelService.createObjectFromData(modelData)

    buildingModel.value = markRaw(model)
    console.log('[后端模式] 建筑模型加载完成')

    return model
  }

  /**
   * 使用前端本地解析加载OBJ模型
   */
  const loadObjModelLocal = async (file: File): Promise<Object3D> => {
    console.log('[本地模式] 开始加载OBJ模型...')

    try {
      // 读取并解析 OBJ 文本
      const objText = await readFileAsText(file)

      // 使用 Blob 创建新的 Object URL
      const blob = new Blob([objText], { type: 'text/plain' })
      const objURL = URL.createObjectURL(blob)

      const loader = new OBJLoader()
      const model: Object3D = await new Promise((resolve, reject) => {
        loader.load(
          objURL,
          (group) => resolve(group),
          undefined,
          (err) => reject(err)
        )
      })
      URL.revokeObjectURL(objURL)

      console.log('[本地模式] OBJ 模型解析完成，开始处理网格法线与材质...')

      // 处理模型材质和法线
      let meshCount = 0
      let lineCount = 0

      model.traverse((child: any) => {
        const isMesh =
          (child as any).isMesh ||
          child.type === 'Mesh' ||
          child instanceof THREE.Mesh ||
          (child.constructor && child.constructor.name === 'Mesh')

        const isLine =
          (child as any).isLine ||
          (child as any).isLineSegments ||
          child.type === 'Line' ||
          child.type === 'LineSegments' ||
          child instanceof THREE.Line ||
          (child.constructor &&
            (child.constructor.name === 'Line' || child.constructor.name === 'LineSegments'))

        if (isMesh) {
          meshCount++
          if (!child.geometry.attributes.normal) {
            child.geometry.computeVertexNormals()
          }

          // 强制使用实心标准材质，双面渲染
          const solidMat = new THREE.MeshStandardMaterial({
            color: 0xcfd8dc,
            metalness: 0.1,
            roughness: 0.8,
            emissive: 0x111111,
            emissiveIntensity: 0.15,
            side: THREE.DoubleSide,
            transparent: false,
            opacity: 1,
            polygonOffset: true,
            polygonOffsetFactor: 1,
            polygonOffsetUnits: 1,
            wireframe: false,
          })
          child.material = solidMat
        } else if (isLine) {
          lineCount++
          child.visible = false
        }
      })

      console.log(`[本地模式] OBJ 解析统计 -> Mesh: ${meshCount}, Line/LineSegments: ${lineCount}`)

      // 计算模型的边界框
      const box = new THREE.Box3().setFromObject(model)
      const size = box.getSize(new THREE.Vector3())
      console.log('[本地模式] 模型尺寸:', {
        x: size.x.toFixed(2),
        y: size.y.toFixed(2),
        z: size.z.toFixed(2),
      })

      buildingModel.value = markRaw(model)
      console.log('[本地模式] 建筑模型加载完成')

      return model
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '未知错误'
      error.value = errorMsg
      console.error('[本地模式] 建筑模型加载失败:', err)
      buildingModel.value = null
      throw err
    }
  }

  /**
   * 加载 OBJ 模型 (自动选择模式)
   */
  const loadObjModel = async (file: File, projectId: string = '1'): Promise<Object3D> => {
    isLoading.value = true
    error.value = null

    try {
      if (useBackend.value) {
        return await loadObjModelFromBackend(file, projectId)
      } else {
        return await loadObjModelLocal(file)
      }
    } catch (err) {
      // 如果后端模式失败,自动降级到本地模式
      if (useBackend.value) {
        console.warn('[后端模式] 加载失败,降级到本地模式:', err)
        useBackend.value = false
        return await loadObjModelLocal(file)
      }
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 从后端加载已保存的模型数据
   */
  const loadModelFromBackend = async (projectId: string = '1'): Promise<Object3D | null> => {
    try {
      console.log('[后端模式] 从后端加载已保存的模型数据...')

      const modelData = await BackendModelService.loadModelData(projectId)
      const model = BackendModelService.createObjectFromData(modelData)

      buildingModel.value = markRaw(model)
      console.log('[后端模式] 建筑模型加载完成')

      return model
    } catch (err) {
      console.error('[后端模式] 加载失败:', err)
      return null
    }
  }

  /**
   * 重置模型
   */
  const resetModel = () => {
    if (buildingModel.value) {
      buildingModel.value.traverse((child: any) => {
        if (child.geometry) child.geometry.dispose()
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((mat: any) => mat.dispose())
          } else {
            child.material.dispose()
          }
        }
      })
      buildingModel.value = null
    }
    error.value = null
  }

  return {
    buildingModel,
    isLoading,
    error,
    useBackend,
    loadObjModel,
    loadModelFromBackend,
    resetModel,
  }
}

