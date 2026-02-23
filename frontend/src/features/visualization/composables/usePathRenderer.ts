import { ref, markRaw } from 'vue'
import * as THREE from 'three'
import type { MeshBasicMaterial } from 'three'

/**
 * 路径渲染 Composable
 * 负责渲染无人机路径和航点
 */
export function usePathRenderer() {
  const pathGroup = ref<THREE.Group | null>(null)
  const showPathLines = ref(false)

  /**
   * 释放组资源
   */
  const disposeGroup = (group: THREE.Group | null) => {
    if (!group) return
    group.traverse((obj: any) => { 
      obj.geometry?.dispose?.()
      obj.material?.dispose?.()
    })
  }

  /**
   * 渲染路径
   */
  const renderPath = (
    parsedPoints: Array<{ x: number; y: number; z: number }>,
    onWaypointClick?: (index: number) => void
  ) => {
    if (parsedPoints.length === 0) {
      disposeGroup(pathGroup.value)
      pathGroup.value = null
      return
    }
    
    // 检查路径点坐标是否有效
    const invalidPoints = parsedPoints.filter(p => 
      !Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)
    )
    if (invalidPoints.length > 0) {
      console.warn('发现无效的路径点:', invalidPoints)
    }
    
    const points = parsedPoints.map(p => ({ x: p.x, y: p.y, z: p.z }))
    
    disposeGroup(pathGroup.value)
    const group = new THREE.Group()

    // 使用更大的球体尺寸
    const sphere = new THREE.SphereGeometry(0.8, 16, 16)

    const createMarkerMaterial = (color: number): MeshBasicMaterial => new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.95,
      depthTest: true,
      depthWrite: true,
    })

    // 起点
    if (points.length > 0) {
      const matStart = createMarkerMaterial(0x00ff00)
      const start = new THREE.Mesh(sphere, matStart)
      start.position.set(points[0].x, points[0].y, points[0].z)
      start.renderOrder = 1500
      start.userData = { isWaypoint: true, index: 0 }
      
      if (onWaypointClick) {
        start.addEventListener('click', () => onWaypointClick(0))
      }
      
      group.add(start)
    }

    // 终点
    if (points.length > 1) {
      const matEnd = createMarkerMaterial(0xff0000)
      const end = new THREE.Mesh(sphere, matEnd)
      end.position.set(
        points[points.length - 1].x,
        points[points.length - 1].y,
        points[points.length - 1].z
      )
      end.renderOrder = 1500
      end.userData = { isWaypoint: true, index: points.length - 1 }
      
      if (onWaypointClick) {
        const index = points.length - 1
        end.addEventListener('click', () => onWaypointClick(index))
      }
      
      group.add(end)
    }

    // 中间点
    if (points.length > 2) {
      const middlePoints = points.slice(1, -1)
      
      for (let i = 0; i < middlePoints.length; i++) {
        const p = middlePoints[i]
        const pointIndex = i + 1
        
        const matMid = createMarkerMaterial(0xffffff)
        const mid = new THREE.Mesh(sphere, matMid)
        mid.position.set(p.x, p.y, p.z)
        mid.renderOrder = 1500
        mid.userData = { isWaypoint: true, index: pointIndex }
        
        if (onWaypointClick) {
          mid.addEventListener('click', () => onWaypointClick(pointIndex))
        }
        
        group.add(mid)
      }
    }

    // 线段
    if (showPathLines.value && points.length >= 2) {
      const vertices = points.flatMap(p => [p.x, p.y, p.z])
      const geom = new THREE.BufferGeometry()
      geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3))
      
      const lineMaterial = new THREE.LineBasicMaterial({ 
        color: 0x888888,
        linewidth: 5,
        depthTest: true,
        depthWrite: true,
      })
      
      const line = new THREE.Line(geom, lineMaterial)
      group.add(line)
      
      // 添加方向箭头
      const segCount = points.length - 1
      if (segCount > 0) {
        const arrowGeometry = new THREE.ConeGeometry(0.6, 1.6, 12)
        const arrowMaterial = new THREE.MeshBasicMaterial({ 
          color: 0xf47920,
          depthTest: true,
          depthWrite: true,
          transparent: true,
          opacity: 0.9,
        })
        const arrows = new THREE.InstancedMesh(arrowGeometry, arrowMaterial, segCount)
        arrows.renderOrder = 1600
        
        const m = new THREE.Matrix4()
        const up = new THREE.Vector3(0, 1, 0)
        
        for (let i = 0; i < segCount; i++) {
          const p1 = new THREE.Vector3(points[i].x, points[i].y, points[i].z)
          const p2 = new THREE.Vector3(points[i+1].x, points[i+1].y, points[i+1].z)
          
          const dir = new THREE.Vector3().subVectors(p2, p1)
          const len = dir.length()
          if (len === 0) continue
          dir.normalize()
          
          const q = new THREE.Quaternion().setFromUnitVectors(up, dir)
          const fixedDistance = 5.0
          const arrowDistance = Math.min(fixedDistance, len * 0.8)
          const pos = new THREE.Vector3().copy(p1).addScaledVector(dir, arrowDistance)
          const scale = new THREE.Vector3(1.0, Math.max(1.0, Math.min(2.5, len * 0.3)), 1.0)
          
          m.compose(pos, q, scale)
          arrows.setMatrixAt(i, m)
        }
        
        arrows.instanceMatrix.needsUpdate = true
        group.add(arrows)
      }
    }

    pathGroup.value = markRaw(group)
  }

  /**
   * 重置路径
   */
  const resetPath = () => {
    disposeGroup(pathGroup.value)
    pathGroup.value = null
  }

  return {
    pathGroup,
    showPathLines,
    renderPath,
    resetPath
  }
}

