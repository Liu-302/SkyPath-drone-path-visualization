import { ref } from 'vue'
import * as THREE from 'three'
import type { Object3D } from 'three'
import { animate } from '@/shared/utils/tween'

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
    controlsRef?: any,
    cameraRef?: any
  ) => {
    // console.log('调整相机位置...')

    // 计算场景的整体边界
    const sceneBounds = new THREE.Box3()

    // 如果有建筑模型，包含建筑模型的边界
    if (buildingModel) {
      const modelBox = new THREE.Box3().setFromObject(buildingModel)
      sceneBounds.union(modelBox)
    }

    // 包含路径点的边界
    if (pathPoints.length > 0) {
      const pathBounds = new THREE.Box3()
      pathPoints.forEach(p => {
        pathBounds.expandByPoint(new THREE.Vector3(p.x, p.y, p.z))
      })
      sceneBounds.union(pathBounds)
    }

    // 如果没有边界数据，使用默认值
    if (sceneBounds.isEmpty()) {
      cameraPosition.value = [100, 100, 100]
      return
    }

    const center = sceneBounds.getCenter(new THREE.Vector3())
    const size = sceneBounds.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)

    // 增加距离确保能看到整个场景
    const dist = maxDim * 0.6

    // 相机方向：从目标指向相机，即 -direction（direction 为相机看向目标的方向）
    // 用户选定值：direction=(-0.47,-0.20,0.86) => 相机在 (0.47, 0.20, -0.86) 方向
    const dir = new THREE.Vector3(0.47, 0.20, -0.86).normalize()
    const targetPos = [
      center.x + dir.x * dist,
      center.y + dir.y * dist,
      center.z + dir.z * dist
    ]
    const targetFocus = [center.x, center.y, center.z]


    // 检查是否有 controlsRef
    // 在 Visualize.vue 中，controlsRef 是一个 Ref<OrbitControlsInstance | null>
    // TresJS 的这一块比较混乱，有时需要多层解包
    const ctrl = controlsRef && (controlsRef.target ? controlsRef : (controlsRef.value?.value || controlsRef.value))
    const cam = cameraRef && (cameraRef.isCamera ? cameraRef : (cameraRef.value?.value || cameraRef.value))

    if (ctrl) {
      // 动画过渡
      // 优先从真实相机对象获取当前位置，否则使用 stored ref
      const currentPos = cam ? [cam.position.x, cam.position.y, cam.position.z] : cameraPosition.value
      const startPos = [currentPos[0], currentPos[1], currentPos[2]]
      
      // OrbitControls target 可能是 Vector3 也可能是 {x,y,z}
      const currentTx = ctrl.target?.x ?? 0
      const currentTy = ctrl.target?.y ?? 0
      const currentTz = ctrl.target?.z ?? 0
      const startFocus = [currentTx, currentTy, currentTz]

      // 确保目标值为数字
      const safeTargetPos = targetPos.map(n => Number(n) || 0)
      const safeTargetFocus = targetFocus.map(n => Number(n) || 0)

      animate(startPos, safeTargetPos, 1000, (val) => {
        // 更新响应式变量 (TresJS prop)
        cameraPosition.value = [val[0], val[1], val[2]]
        // 如果有相机对象，也直接更新它以便更丝滑 (TresJS绑定有时有延迟)
        if (cam) {
            cam.position.set(val[0], val[1], val[2])
            // cam.updateMatrixWorld() // 有时需要手动更新矩阵
        }
      })

      animate(startFocus, safeTargetFocus, 1000, (val) => {
        if (ctrl.target) {
            ctrl.target.set(val[0], val[1], val[2])
            ctrl.update()
        }
      })
    } else {
      console.warn('[AdjustCamera] No controls found, snapping.')
      // 无控制器时直接跳转
      cameraPosition.value = [targetPos[0], targetPos[1], targetPos[2]]
      if (cam) cam.position.set(targetPos[0], targetPos[1], targetPos[2])
    }
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

