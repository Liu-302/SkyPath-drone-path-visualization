<!--
  相机视锥体可视化组件
  
  文件作用：

    cameraDir.value = direction || { x: 0, y: -1, z: 0 }

    const corners = calculateFrustumCorners(
  负责人：成员C/D
  使用方：Visualize.vue（在页面中引入并显示）
  
  开发阶段：
  1. 先用Mock数据开发，显示视锥体线框或半透明实体
  2. 然后从viewpoint.ts store读取真实数据
  3. 响应视点选择事件，更新显示的视锥体
-->

<template>
  <!-- 使用TresJS在Three.js场景中渲染视锥体 -->
  <TresGroup v-if="visible && cameraView">
    <!-- 绘制视锥体的每条边（线框）- 使用primitive直接渲染Three.js Line对象 -->
    <primitive v-for="(lineObj, idx) in lineObjects" :key="idx" :object="lineObj" />
  </TresGroup>
</template>

<script setup lang="ts">
import { ref, computed, watch, markRaw } from 'vue'
import type { CameraView } from '@/features/visualization/types/camera'
import { buildPyramidFromCamera, calculateCameraOrientationFromNormal, computeDynamicHToMesh, vfovToHfov } from '@/shared/utils/camera-utils'
import { COVERAGE_CONFIG } from '@/shared/constants/constants'
import { Line, BufferGeometry, BufferAttribute, LineBasicMaterial, type Object3D } from 'three'

interface Props {
  /** 相机视角信息 */
  cameraView: CameraView | null
  
  /** 是否显示视锥体 */
  visible: boolean

  /** 建筑模型（用于动态计算 h：射线最近命中距离） */
  buildingMesh?: Object3D | null

  /**
   * 真实相机视场角（度）
   * - vfovDeg：垂直视场角
   * - hfovDeg：水平视场角（可不传，将由 vfovDeg + aspect 推导）
   */
  /** Override VFOV (default: COVERAGE_CONFIG.vfov to match BuildingHighlighter) */
  vfovDeg?: number
  hfovDeg?: number
}

const props = withDefaults(defineProps<Props>(), {
  cameraView: null,
  visible: false,
  buildingMesh: null,
  vfovDeg: COVERAGE_CONFIG.vfov,
  hfovDeg: undefined,
})


// 响应式数据
const edges = ref<Array<Array<[number, number, number]>>>([])
const lineObjects = ref<Line[]>([]) // Three.js Line对象数组
const cameraDir = ref({ x: 0, y: -1, z: 0 })
const cameraView = computed(() => props.cameraView)

function buildPyramidEdges(
  apex: { x: number; y: number; z: number },
  baseCorners: Array<{ x: number; y: number; z: number }>
) {
  // baseCorners order: [b1,b2,b3,b4] around the rectangle
  const v = apex
  const [b1, b2, b3, b4] = baseCorners
  const edgePairs: Array<[any, any]> = [
    [v, b1],
    [v, b2],
    [v, b3],
    [v, b4],
    [b1, b2],
    [b2, b3],
    [b3, b4],
    [b4, b1],
  ]

  return edgePairs.map(([a, b]) => [[a.x, a.y, a.z], [b.x, b.y, b.z]] as Array<[number, number, number]>)
}

watch([
  () => props.cameraView,
  () => props.visible,
  () => props.buildingMesh,
  () => props.vfovDeg,
  () => props.hfovDeg,
], ([newView, vis]) => {
  // console.log('CameraFrustum watch触发:', { hasView: !!newView, visible: vis, viewPosition: newView?.position })
  if (!vis || !newView) {
    edges.value = []
    lineObjects.value = [] // 清空Line对象
    // console.log('CameraFrustum: 条件不满足，清空edges和lineObjects')
    return
  }

  // 兼容性处理：cameraView 可能只包含 normal 或 direction
  let direction = newView.direction
  if ((!direction || (!direction.x && !direction.y && !direction.z)) && (newView as any).normal) {
    const orient = calculateCameraOrientationFromNormal((newView as any).normal)
    direction = orient.direction
  }

  cameraDir.value = direction || { x: 0, y: -1, z: 0 }

  // 与 BuildingHighlighter 使用相同参数，确保线框与高亮投影范围一致
  const vfovDeg = props.vfovDeg ?? COVERAGE_CONFIG.vfov
  const hfovDeg = props.hfovDeg ?? vfovToHfov(vfovDeg, COVERAGE_CONFIG.aspect)
  const dir = direction || { x: 0, y: -1, z: 0 }
  const h = computeDynamicHToMesh(newView.position, dir, props.buildingMesh, COVERAGE_CONFIG.fallbackH)
  const pyramid = buildPyramidFromCamera(newView.position, dir, vfovDeg, hfovDeg, h)
  edges.value = buildPyramidEdges(
    { x: pyramid.apex.x, y: pyramid.apex.y, z: pyramid.apex.z },
    pyramid.base.map(p => ({ x: p.x, y: p.y, z: p.z }))
  )

  // 创建Three.js Line对象数组
  const lines: Line[] = []
  edges.value.forEach((edge) => {
    const geometry = new BufferGeometry()
    const positions = new Float32Array([
      edge[0][0], edge[0][1], edge[0][2],
      edge[1][0], edge[1][1], edge[1][2]
    ])
      geometry.setAttribute('position', new BufferAttribute(positions, 3))
      
      const material = new LineBasicMaterial({
        color: 0xff6b6b,
        linewidth: 5,
        depthTest: true,
        depthWrite: false,
      })
      
      const line = new Line(geometry, material)
      line.renderOrder = 1500 // 确保在其他对象之上渲染
      line.frustumCulled = false
      lines.push(markRaw(line))
    })
    lineObjects.value = lines

    // 注：如需显示半透明“锥体面”，可以按 pyramid 的 5 个点构造 Mesh（此处仍只画线框）
  },
  { immediate: true, deep: true }
)
</script>

<style scoped>
/* Frustum color and effect params are set inline in LineBasicMaterial */
</style>