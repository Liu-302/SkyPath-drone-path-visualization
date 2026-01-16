import { ref, markRaw } from 'vue'
import { OBJLoader } from 'three-stdlib'
import * as THREE from 'three'
import type { Object3D } from 'three'

/**
 * 模型加载 Composable
 * 负责加载和处理 OBJ 模型文件
 */
export function useModelLoader() {
  const buildingModel = ref<Object3D | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

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
   * 加载 OBJ 模型
   */
  const loadObjModel = async (file: File) => {
    isLoading.value = true
    error.value = null
    
    try {
      console.log('开始加载OBJ模型...')
      
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
      
      console.log('OBJ 模型解析完成，开始处理网格法线与材质...')
      
      // 处理模型材质和法线
      let meshCount = 0
      let lineCount = 0
      
      model.traverse((child: any) => {
        const isMesh = (child as any).isMesh || 
                       child.type === 'Mesh' || 
                       child instanceof THREE.Mesh ||
                       (child.constructor && child.constructor.name === 'Mesh')
        
        const isLine = (child as any).isLine || 
                       (child as any).isLineSegments ||
                       child.type === 'Line' || 
                       child.type === 'LineSegments' ||
                       child instanceof THREE.Line ||
                       (child.constructor && (child.constructor.name === 'Line' || child.constructor.name === 'LineSegments'))
        
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
            wireframe: false
          })
          child.material = solidMat
        } else if (isLine) {
          lineCount++
          child.visible = false
        }
      })
      
      console.log(`OBJ 解析统计 -> Mesh: ${meshCount}, Line/LineSegments: ${lineCount}`)
      
      // 计算模型的边界框
      const box = new THREE.Box3().setFromObject(model)
      const size = box.getSize(new THREE.Vector3())
      console.log('模型尺寸:', {
        x: size.x.toFixed(2),
        y: size.y.toFixed(2),
        z: size.z.toFixed(2)
      })

      buildingModel.value = markRaw(model)
      console.log('建筑模型加载完成')
      
      return model
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '未知错误'
      error.value = errorMsg
      console.error('建筑模型加载失败:', err)
      buildingModel.value = null
      throw err
    } finally {
      isLoading.value = false
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
    loadObjModel,
    resetModel
  }
}

