<template>
  <div class="axis-gizmo-container">
    <div ref="canvasContainer" class="canvas-container"></div>
    <div class="axis-labels">
      <span class="label x-label">X</span>
      <span class="label y-label">Y</span>
      <span class="label z-label">Z</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  Group,
  ArrowHelper,
  Vector3,
  DirectionalLight,
  AmbientLight,
  OrthographicCamera,
  Vector2
} from 'three'

const canvasContainer = ref<HTMLElement>()

let renderer: WebGLRenderer | null = null
let scene: Scene | null = null
let camera: PerspectiveCamera | OrthographicCamera | null = null
let axisGroup: Group | null = null

// 颜色定义
const COLORS = {
  x: 0xFF3333, // 红色
  y: 0x33FF33, // 绿色
  z: 0x3333FF, // 蓝色
  xLabel: '#FF3333',
  yLabel: '#33FF33',
  zLabel: '#3333FF'
}

// 存储坐标轴末端位置
const axisEnds = {
  x: new Vector2(),
  y: new Vector2(),
  z: new Vector2()
}

onMounted(() => {
  initGizmo()
})

onBeforeUnmount(() => {
  cleanup()
})

function initGizmo() {
  if (!canvasContainer.value) return

  // 创建场景
  scene = new Scene()

  // 创建相机（正交相机，保证坐标轴大小不变）
  const aspect = canvasContainer.value.clientWidth / canvasContainer.value.clientHeight
  const frustumSize = 2.5
  camera = new OrthographicCamera(
    -frustumSize * aspect,
    frustumSize * aspect,
    frustumSize,
    -frustumSize,
    0.1,
    1000
  )
  camera.position.set(0, 0, 5)

  // 创建渲染器
  renderer = new WebGLRenderer({
    alpha: true,
    antialias: true
  })
  renderer.setSize(canvasContainer.value.clientWidth, canvasContainer.value.clientHeight)
  renderer.setPixelRatio(window.devicePixelRatio)
  canvasContainer.value.appendChild(renderer.domElement)

  // 添加灯光
  scene.add(new AmbientLight(0xffffff, 1))
  const directionalLight = new DirectionalLight(0xffffff, 1)
  directionalLight.position.set(5, 5, 5)
  scene.add(directionalLight)

  // 创建坐标轴组
  axisGroup = new Group()

  // 创建三个坐标轴箭头（加粗、加长）
  const arrowLength = 1.8
  const coneLength = 0.2
  const coneWidth = 0.8
  const shaftWidth = 0.6

  const xAxis = new ArrowHelper(
    new Vector3(1, 0, 0),
    new Vector3(0, 0, 0),
    arrowLength,
    COLORS.x,
    shaftWidth
  )
  xAxis.line.scale.set(1, 1, 1)
  xAxis.cone.scale.set(coneWidth / 0.15, coneLength / 0.3, coneWidth / 0.15)

  const yAxis = new ArrowHelper(
    new Vector3(0, 1, 0),
    new Vector3(0, 0, 0),
    arrowLength,
    COLORS.y,
    shaftWidth
  )
  yAxis.line.scale.set(1, 1, 1)
  yAxis.cone.scale.set(coneWidth / 0.15, coneLength / 0.3, coneWidth / 0.15)

  const zAxis = new ArrowHelper(
    new Vector3(0, 0, -1),
    new Vector3(0, 0, 0),
    arrowLength,
    COLORS.z,
    shaftWidth
  )
  zAxis.line.scale.set(1, 1, 1)
  zAxis.cone.scale.set(coneWidth / 0.15, coneLength / 0.3, coneWidth / 0.15)

  axisGroup.add(xAxis)
  axisGroup.add(yAxis)
  axisGroup.add(zAxis)

  scene.add(axisGroup)

  // 监听全局相机事件
  window.addEventListener('camera-update', onCameraUpdate)

  // 开始渲染循环
  animate()

  // 监听窗口大小变化
  window.addEventListener('resize', onWindowResize)
}

function onCameraUpdate(event: Event) {
  if (!axisGroup) return

  const customEvent = event as CustomEvent
  if (!customEvent.detail) return

  const { quaternion } = customEvent.detail
  if (quaternion) {
    // 同步主相机的旋转到坐标轴指示器
    axisGroup.quaternion.copy(quaternion)
    // 更新标签位置
    updateLabelPositions()
  }
}

function updateLabelPositions() {
  if (!camera || !canvasContainer.value || !axisGroup) return


  // 投影坐标轴末端位置
  const xEnd = new Vector3(1.2, 0, 0).applyQuaternion(axisGroup.quaternion)
  const yEnd = new Vector3(0, 1.2, 0).applyQuaternion(axisGroup.quaternion)
  const zEnd = new Vector3(0, 0, -1.2).applyQuaternion(axisGroup.quaternion)

  // 转换到屏幕坐标
  const xScreen = toScreenPosition(xEnd)
  const yScreen = toScreenPosition(yEnd)
  const zScreen = toScreenPosition(zEnd)

  // 更新标签位置
  axisEnds.x.set(xScreen.x, xScreen.y)
  axisEnds.y.set(yScreen.x, yScreen.y)
  axisEnds.z.set(zScreen.x, zScreen.y)

  // 更新DOM标签位置
  updateLabel('.x-label', axisEnds.x.x, axisEnds.x.y)
  updateLabel('.y-label', axisEnds.y.x, axisEnds.y.y)
  updateLabel('.z-label', axisEnds.z.x, axisEnds.z.y)
}

function toScreenPosition(position: Vector3) {
  if (!camera || !canvasContainer.value) return { x: 0, y: 0 }

  const vector = position.clone()
  vector.project(camera as any)

  const width = canvasContainer.value.clientWidth
  const height = canvasContainer.value.clientHeight

  return {
    x: (vector.x * 0.5 + 0.5) * width,
    y: (-vector.y * 0.5 + 0.5) * height
  }
}

function updateLabel(selector: string, x: number, y: number) {
  const label = document.querySelector(`.axis-gizmo-container ${selector}`) as HTMLElement
  if (label) {
    label.style.left = `${x + 10}px`
    label.style.top = `${y - 10}px`
  }
}

function animate() {
  if (!renderer || !scene || !camera) return
  renderer.render(scene, camera)
  updateLabelPositions()
  requestAnimationFrame(animate)
}

function onWindowResize() {
  if (!renderer || !camera || !canvasContainer.value) return

  const width = canvasContainer.value.clientWidth
  const height = canvasContainer.value.clientHeight
  const aspect = width / height
  const frustumSize = 2.5

  if (camera instanceof OrthographicCamera) {
    camera.left = -frustumSize * aspect
    camera.right = frustumSize * aspect
    camera.top = frustumSize
    camera.bottom = -frustumSize
  }

  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
}

function cleanup() {
  window.removeEventListener('camera-update', onCameraUpdate)
  window.removeEventListener('resize', onWindowResize)

  if (renderer) {
    renderer.dispose()
    if (canvasContainer.value && renderer.domElement) {
      canvasContainer.value.removeChild(renderer.domElement)
    }
  }
}
</script>

<style scoped>
.axis-gizmo-container {
  position: absolute;
  top: 34px; /* 调整为工具栏高度 + 间距 */
  right: 400px;
  width: 180px;
  height: 180px;
  z-index: 1000;
  pointer-events: none;
}

.canvas-container {
  width: 100%;
  height: 100%;
}

.axis-labels {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.label {
  position: absolute;
  font-size: 16px;
  font-weight: bold;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
  pointer-events: none;
  transform: translate(-50%, -50%);
  white-space: nowrap;
}

.label.x-label {
  color: #FF3333;
}

.label.y-label {
  color: #33FF33;
}

.label.z-label {
  color: #3333FF;
}
</style>
