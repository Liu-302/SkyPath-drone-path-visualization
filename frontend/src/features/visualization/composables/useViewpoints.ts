import { computed } from 'vue'
import { calculateCameraOrientationFromNormal } from '@/shared/utils/camera-utils'
import { CAMERA_CONFIG } from '@/shared/constants/constants'

/**
 * 视图点计算 Composable
 * 负责从路径点计算视图点信息
 */
export function useViewpoints(parsedPoints: () => Array<{ 
  x: number
  y: number
  z: number
  normal?: { x: number; y: number; z: number }
}>) {
  const viewpoints = computed(() => {
    return parsedPoints().map((p: any, i: number) => {
      // 如果有normal向量，使用它作为相机朝向；否则使用默认向下方向
      let direction = { x: 0, y: -1, z: 0 }
      let up = { x: 0, y: 0, z: 1 }
      
      // 检查是否有normal向量
      if (p.normal) {
        const normalVec = { 
          x: p.normal.x ?? 0, 
          y: p.normal.y ?? 0, 
          z: p.normal.z ?? 0 
        }
        // 如果normal向量不是零向量，使用它作为相机朝向
        const normalLength = Math.sqrt(normalVec.x * normalVec.x + normalVec.y * normalVec.y + normalVec.z * normalVec.z)
        if (normalLength > 0.001) {
          // 计算相机朝向和上方向向量
          const orient = calculateCameraOrientationFromNormal(normalVec)
          direction = orient.direction
          up = orient.up
        } else {
          console.warn(`Viewpoint ${i + 1}: normal向量为零向量，使用默认向下方向`)
        }
      } else {
        console.warn(`Viewpoint ${i + 1}: 缺少normal向量，使用默认向下方向`)
      }
      
      return {
        id: i + 1,
        position: { x: p.x, y: p.y, z: p.z },
        direction,
        up,
        fov: CAMERA_CONFIG.fov,
        aspect: CAMERA_CONFIG.aspect,
        near: CAMERA_CONFIG.near,
        far: 20 // 减小far距离，视锥体不会太大
      }
    })
  })

  return {
    viewpoints
  }
}

