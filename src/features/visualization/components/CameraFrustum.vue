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
// TODO: 成员C/D需要实现以下功能
// 1. 接收相机参数（位置、朝向、FOV等）
// 2. 调用camera-utils.ts计算视锥体角点
// 3. 创建Three.js几何体并添加到场景
// 4. 响应点击事件，更新显示的视锥体

import { ref, computed, watch, markRaw } from 'vue'
import type { CameraView } from '@/features/visualization/types/camera'
import { calculateFrustumCorners, calculateCameraOrientationFromNormal } from '@/shared/utils/camera-utils'
import { CAMERA_CONFIG } from '@/shared/constants/constants'
import { Line, BufferGeometry, BufferAttribute, LineBasicMaterial } from 'three'

interface Props {
  /** 相机视角信息 */
  cameraView: CameraView | null
  
  /** 是否显示视锥体 */
  visible: boolean
}

const props = withDefaults(defineProps<Props>(), {
  cameraView: null,
  visible: false,
})


// 响应式数据
const edges = ref<Array<Array<[number, number, number]>>>([])
const lineObjects = ref<Line[]>([]) // Three.js Line对象数组
const cameraDir = ref({ x: 0, y: -1, z: 0 })
const cameraView = computed(() => props.cameraView)

function buildEdgesFromCorners(corners: any) {
  // corners: { near: [{x,y,z}...], far: [...] }
  const pts = [...corners.near, ...corners.far]
  // 边的索引（与createFrustumGeometry一致）
  const edgeIdx = [
    [0,1],[1,2],[2,3],[3,0], // near
    [4,5],[5,6],[6,7],[7,4], // far
    [0,4],[1,5],[2,6],[3,7]  // connections
  ]

  const built: Array<Array<[number, number, number]>> = []
  edgeIdx.forEach(([a,b]) => {
    const pa = pts[a]
    const pb = pts[b]
    built.push([[pa.x, pa.y, pa.z], [pb.x, pb.y, pb.z]])
  })
  return built
}

watch([
  () => props.cameraView,
  () => props.visible
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
  let up = (newView as any).up
  if ((!direction || (!direction.x && !direction.y && !direction.z)) && (newView as any).normal) {
    const orient = calculateCameraOrientationFromNormal((newView as any).normal)
    direction = orient.direction
    up = orient.up
  }

  cameraDir.value = direction || { x: 0, y: -1, z: 0 }

  const corners = calculateFrustumCorners(
    newView.position,
    direction || { x: 0, y: -1, z: 0 },
    up || { x: 0,  y: 0, z: 1 },
    newView.fov || CAMERA_CONFIG.fov,
    newView.aspect || CAMERA_CONFIG.aspect,
    newView.near || CAMERA_CONFIG.near,
    newView.far || CAMERA_CONFIG.far
  )

  // console.log('CameraFrustum: corners computed', corners)
  edges.value = buildEdgesFromCorners(corners)
  // console.log('CameraFrustum: edges built count=', edges.value.length)

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
        color: 0xff6b6b, // 红色
        linewidth: 5,
        depthTest: false, // 禁用深度测试，确保总是可见
        depthWrite: false,
      })
      
      const line = new Line(geometry, material)
      line.renderOrder = 1500 // 确保在其他对象之上渲染
      line.frustumCulled = false
      lines.push(markRaw(line))
    })
    lineObjects.value = lines

    // 注：createFrustumGeometry 返回 BufferGeometry，可用于更高级的 mesh 渲染（如面/半透明）
    // const geometry = createFrustumGeometry(corners)
    // TODO: 如果想要半透明面，可创建 TresMesh 并设置 geometry
  },
  { immediate: true, deep: true }
)
</script>

<style scoped>
/* TODO: 成员C/D需要设计样式 */
/* 视锥体颜色、透明度等效果参数 */
</style>