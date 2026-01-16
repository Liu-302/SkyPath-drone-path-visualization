<!--
  建筑物高亮组件
  
  文件作用：
  - 高亮显示被相机拍摄到的建筑物区域
  - 根据视锥体计算可见的建筑物面
  - 修改建筑物网格的材质，使被拍摄区域变亮
  
  负责人：成员C/D
  使用方：Visualize.vue（在页面中引入并显示）
  
  开发阶段：
  1. 先用Mock数据开发，实现高亮效果
  2. 然后从viewpoint.ts store读取真实数据
  3. 根据视锥体计算可见面并高亮
-->

<template>
  <!-- 这个组件通过脚本操作 Three.js 对象来实现高亮；模板不需要输出节点 -->
  <div style="display:none"></div>
</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import type { CameraView } from '@/features/visualization/types/camera'
import { calculateFrustumCorners, getVisibleMeshFaces, estimateCameraPositionFromFrustum } from '@/shared/utils/camera-utils'
import { BufferGeometry, BufferAttribute, Mesh, MeshBasicMaterial, DoubleSide, Vector3, AdditiveBlending, Points, PointsMaterial } from 'three'
import { CAMERA_CONFIG } from '@/shared/constants/constants'

interface Props {
  cameraView: CameraView | null
  buildingMesh: any | null
  visible: boolean
  debugMarkers?: boolean
  fallbackCount?: number
}

const props = withDefaults(defineProps<Props>(), {
  cameraView: null,
  buildingMesh: null,
  visible: false,
  debugMarkers: true,
  fallbackCount: 0,
})

// highlight mesh instances we create per source mesh
const highlightMeshes = ref<Array<Mesh>>([])
const markerEntities = ref<Array<Points>>([])

function disposeHighlight() {
  if (!highlightMeshes.value.length) return
  try {
    for (const hm of highlightMeshes.value) {
      const g = hm.geometry as BufferGeometry
      const m = hm.material as any
      hm.parent?.remove(hm)
      g?.dispose()
      if (m) {
        if (Array.isArray(m)) m.forEach(x => x.dispose && x.dispose())
        else m.dispose && m.dispose()
      }
    }
    for (const marker of markerEntities.value) {
      marker.parent?.remove(marker)
      marker.geometry?.dispose()
      ;(marker.material as any)?.dispose?.()
    }
  } catch (e) {
    console.warn('error disposing highlight', e)
  }
  highlightMeshes.value = []
  markerEntities.value = []
}

function buildHighlightMeshFromFaces(mesh: any, faceIndices: number[]): Mesh | null {
  const geometry: BufferGeometry = mesh.geometry
  const posAttr = geometry.getAttribute('position') as BufferAttribute
  const index = geometry.getIndex()
  if (!posAttr) return null

  const positions: number[] = []
  for (const fi of faceIndices) {
    const aIdx = index ? index.getX(fi * 3) : fi * 3
    const bIdx = index ? index.getX(fi * 3 + 1) : fi * 3 + 1
    const cIdx = index ? index.getX(fi * 3 + 2) : fi * 3 + 2

    // Read vertex positions (local space)
    const ax = posAttr.getX(aIdx), ay = posAttr.getY(aIdx), az = posAttr.getZ(aIdx)
    const bx = posAttr.getX(bIdx), by = posAttr.getY(bIdx), bz = posAttr.getZ(bIdx)
    const cx = posAttr.getX(cIdx), cy = posAttr.getY(cIdx), cz = posAttr.getZ(cIdx)

    positions.push(ax, ay, az, bx, by, bz, cx, cy, cz)
  }

  if (positions.length === 0) return null

  const highlightGeom = new BufferGeometry()
  highlightGeom.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  if (typeof highlightGeom.computeVertexNormals === 'function') highlightGeom.computeVertexNormals()

  const mat = new MeshBasicMaterial({
    color: 0xff7b00,
    transparent: true,
    opacity: 0.65,
    depthWrite: false, // 透明物体通常不写入深度，避免影响后面的物体
    depthTest: true, // 启用深度测试，确保高亮会被前面的物体遮挡
    blending: AdditiveBlending,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: 1, // 使用正值，让高亮稍微突出
    polygonOffsetUnits: 1,
    side: DoubleSide,
  })

  const hm = new Mesh(highlightGeom, mat)
  hm.renderOrder = 1 // 在建筑模型（renderOrder=0）之后渲染，确保透明高亮正确显示
  hm.frustumCulled = false
  return hm
}

function buildDebugMarkersFromFaces(mesh: any, faceIndices: number[]): Points | null {
  if (!props.debugMarkers || !faceIndices?.length) return null
  const geometry: BufferGeometry = mesh.geometry
  const posAttr = geometry.getAttribute('position') as BufferAttribute
  const index = geometry.getIndex()
  if (!posAttr) return null

  const maxSamples = Math.min(250, faceIndices.length)
  const step = Math.max(1, Math.floor(faceIndices.length / maxSamples))
  const centroidPositions: number[] = []

  for (let i = 0; i < faceIndices.length; i += step) {
    const face = faceIndices[i]
    const aIdx = index ? index.getX(face * 3) : face * 3
    const bIdx = index ? index.getX(face * 3 + 1) : face * 3 + 1
    const cIdx = index ? index.getX(face * 3 + 2) : face * 3 + 2
    const ax = posAttr.getX(aIdx), ay = posAttr.getY(aIdx), az = posAttr.getZ(aIdx)
    const bx = posAttr.getX(bIdx), by = posAttr.getY(bIdx), bz = posAttr.getZ(bIdx)
    const cx = posAttr.getX(cIdx), cy = posAttr.getY(cIdx), cz = posAttr.getZ(cIdx)
    centroidPositions.push((ax + bx + cx) / 3, (ay + by + cy) / 3, (az + bz + cz) / 3)
  }

  if (!centroidPositions.length) return null

  const markersGeom = new BufferGeometry()
  markersGeom.setAttribute('position', new BufferAttribute(new Float32Array(centroidPositions), 3))
  const material = new PointsMaterial({
    color: 0x00eaff,
    size: 1.2,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.9,
    depthTest: true, // 启用深度测试
    depthWrite: false, // 透明物体不写入深度
    blending: AdditiveBlending,
  })
  const points = new Points(markersGeom, material)
  points.renderOrder = 1100
  points.frustumCulled = false
  return points
}

watch(
  [() => props.cameraView, () => props.buildingMesh, () => props.visible],
  ([newView, newMesh, newVisible]: [CameraView | null, any | null, boolean]) => {
    // console.log('BuildingHighlighter watch触发:', {
    //   hasView: !!newView,
    //   hasMesh: !!newMesh,
    //   visible: newVisible,
    //   viewPosition: newView?.position
    // })
    disposeHighlight()

    if (!newView || !newMesh || !newVisible) {
      // console.log('BuildingHighlighter: 条件不满足，退出')
      return
    }

    try {
      const corners = calculateFrustumCorners(
        newView.position,
        newView.direction || { x: 0, y: -1, z: 0 },
        newView.up || { x: 0, y: 0, z: 1 },
        newView.fov || CAMERA_CONFIG.fov,
        newView.aspect || CAMERA_CONFIG.aspect,
        newView.near || CAMERA_CONFIG.near,
        newView.far || 20 // 使用与 CameraFrustum 相同的默认值，确保一致性
      )
      // console.log('BuildingHighlighter: 视锥体角点计算完成:', corners)
      const camPos = estimateCameraPositionFromFrustum(corners)
      // console.log('BuildingHighlighter: 相机位置估算:', camPos.toArray())

      const meshesToProcess: any[] = []
      if (newMesh.isGroup || newMesh.type === 'Group') {
        newMesh.traverse((child: any) => {
          if (child.isMesh || child.type === 'Mesh') meshesToProcess.push(child)
        })
      } else if (newMesh.isMesh || newMesh.type === 'Mesh') {
        meshesToProcess.push(newMesh)
      }

      for (const srcMesh of meshesToProcess) {
        if (typeof srcMesh.updateWorldMatrix === 'function') srcMesh.updateWorldMatrix(true, false)
        const visibleFaces = getVisibleMeshFaces(corners, srcMesh, newView.position)
        let facesToHighlight = visibleFaces
        if (!facesToHighlight || facesToHighlight.length === 0) {
          try {
            const geometry: BufferGeometry = srcMesh.geometry
            const posAttr = geometry.getAttribute('position') as BufferAttribute
            const index = geometry.getIndex()
            const triCount = index ? index.count / 3 : posAttr.count / 3
            const sample = Math.min(5, Math.floor(triCount))
            for (let i = 0; i < sample; i++) {
              const aIdx = index ? index.getX(i * 3) : i * 3
              const bIdx = index ? index.getX(i * 3 + 1) : i * 3 + 1
              const cIdx = index ? index.getX(i * 3 + 2) : i * 3 + 2
              const ax = posAttr.getX(aIdx), ay = posAttr.getY(aIdx), az = posAttr.getZ(aIdx)
              const bx = posAttr.getX(bIdx), by = posAttr.getY(bIdx), bz = posAttr.getZ(bIdx)
              const cx = posAttr.getX(cIdx), cy = posAttr.getY(cIdx), cz = posAttr.getZ(cIdx)
              const centroid = new Vector3((ax + bx + cx) / 3, (ay + by + cy) / 3, (az + bz + cz) / 3)
              if (typeof srcMesh.localToWorld === 'function') srcMesh.localToWorld(centroid)
            const viewDir = new Vector3().subVectors(camPos, centroid)
            const ux = bx - ax, uy = by - ay, uz = bz - az
            const vx = cx - ax, vy = cy - ay, vz = cz - az
            const normal = new Vector3(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx).normalize()
            normal.dot(viewDir.normalize())
            }
          } catch (err) {
            console.warn('BuildingHighlighter: sampling debug failed', err)
          }
          if ((!facesToHighlight || facesToHighlight.length === 0) && props.fallbackCount > 0) {
            const geometry: BufferGeometry = srcMesh.geometry
            const index = geometry.getIndex()
            const triCount = index ? index.count / 3 : geometry.getAttribute('position')?.count / 3 || 0
            const triLimit = Math.min(props.fallbackCount, triCount)
            facesToHighlight = Array.from({ length: triLimit }, (_, idx) => idx)
          }
          if (!facesToHighlight || facesToHighlight.length === 0) {
            continue
          }
        }

        const hm = buildHighlightMeshFromFaces(srcMesh, facesToHighlight)
        if (!hm) {
          console.warn('BuildingHighlighter: 创建高亮mesh失败，faces数量:', facesToHighlight.length)
          continue
        }
        srcMesh.add(hm)
        highlightMeshes.value.push(hm)

        const marker = buildDebugMarkersFromFaces(srcMesh, facesToHighlight)
        if (marker) {
          srcMesh.add(marker)
          markerEntities.value.push(marker)
        }
      }
    } catch (e) {
      console.error('BuildingHighlighter update failed', e)
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  disposeHighlight()
})
</script>

<style scoped>
/* no styles needed */
</style>