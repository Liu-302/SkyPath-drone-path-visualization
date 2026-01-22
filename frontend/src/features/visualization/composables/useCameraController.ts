import { ref } from 'vue'
import * as THREE from 'three'
import type { Object3D } from 'three'

/**
 * 相机控制器 Composable
 * 负责相机位置调整和网格更新
 */
export function useCameraController() {
  const cameraPosition = ref<[number, number, number]>([100, 100, 100])
  const gridSize = ref(100)
  const gridDivisions = ref(20)
  const gridPosition = ref<[number, number, number]>([0, 0, 0])
  const showGrid = ref(true)

  /**
   * 根据模型更新网格
   */
  const updateGridFromModel = (model: Object3D | null) => {
    if (!model) return
    const box = new THREE.Box3().setFromObject(model)
    const center = box.getCenter(new THREE.Vector3())
    gridPosition.value = [center.x, box.min.y + 0.01, center.z]
    gridSize.value = Math.max(
      Math.abs(box.max.x - box.min.x), 
      Math.abs(box.max.z - box.min.z)
    ) * 1.3
  }

  /**
   * 调整相机位置以适应场景
   */
  const adjustCamera = (
    buildingModel: Object3D | null,
    pathPoints: Array<{ x: number; y: number; z: number }>,
    controlsRef?: any
  ) => {
    // console.log('调整相机位置...')

    // 计算场景的整体边界
    const sceneBounds = new THREE.Box3()

    // 如果有建筑模型，包含建筑模型的边界
    if (buildingModel) {
      const modelBox = new THREE.Box3().setFromObject(buildingModel)
      sceneBounds.union(modelBox)
      if (import.meta.env.DEV && false) {
        console.log('建筑模型边界:', {
          min: `(${modelBox.min.x.toFixed(2)}, ${modelBox.min.y.toFixed(2)}, ${modelBox.min.z.toFixed(2)})`,
          max: `(${modelBox.max.x.toFixed(2)}, ${modelBox.max.y.toFixed(2)}, ${modelBox.max.z.toFixed(2)})`
        })
      }
    }

    // 包含路径点的边界
    if (pathPoints.length > 0) {
      const pathBounds = new THREE.Box3()
      pathPoints.forEach(p => {
        pathBounds.expandByPoint(new THREE.Vector3(p.x, p.y, p.z))
      })
      sceneBounds.union(pathBounds)
      if (import.meta.env.DEV && false) {
        console.log('路径点边界:', {
          min: `(${pathBounds.min.x.toFixed(2)}, ${pathBounds.min.y.toFixed(2)}, ${pathBounds.min.z.toFixed(2)})`,
          max: `(${pathBounds.max.x.toFixed(2)}, ${pathBounds.max.y.toFixed(2)}, ${pathBounds.max.z.toFixed(2)})`
        })
      }
    }

    // 如果没有边界数据，使用默认值
    if (sceneBounds.isEmpty()) {
      console.log('没有场景边界数据，使用默认相机位置')
      cameraPosition.value = [100, 100, 100]
      return
    }

    const center = sceneBounds.getCenter(new THREE.Vector3())
    const size = sceneBounds.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)

    // 增加距离确保能看到整个场景
    const dist = maxDim * 0.5

    if (import.meta.env.DEV && false) {
      console.log('场景整体信息:')
      console.log('  中心:', center.x.toFixed(2), center.y.toFixed(2), center.z.toFixed(2))
      console.log('  尺寸:', size.x.toFixed(2), size.y.toFixed(2), size.z.toFixed(2))
      console.log('  最大维度:', maxDim.toFixed(2))
      console.log('  相机距离:', dist.toFixed(2))
    }

    cameraPosition.value = [center.x + dist, center.y + dist, center.z + dist]

    // 更新相机控制器目标
    // 注意：TresJS 的 ref 结构可能是嵌套的 controlsRef.value?.value
    setTimeout(() => {
      const ctrl = controlsRef?.value?.value || controlsRef?.value
      if (ctrl && ctrl.target) {
        ctrl.target.set(center.x, center.y, center.z)
        ctrl.update()
        // console.log('相机已调整到场景中心')
      }
    }, 200)
  }

  return {
    cameraPosition,
    gridSize,
    gridDivisions,
    gridPosition,
    showGrid,
    updateGridFromModel,
    adjustCamera
  }
}

