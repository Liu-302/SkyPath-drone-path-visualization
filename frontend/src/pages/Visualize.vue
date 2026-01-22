<template>
  <div class="viewer-container">
    
    <TresCanvas 
      v-bind="state" 
      window-size 
      @loop="onLoop" 
      @click="handleCanvasClick"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseLeave"
      :style="{ cursor: getCursorStyle() }"
    >
      <TresPerspectiveCamera
        make-default
        ref="cameraRef"
        :position="cameraPosition"
        :fov="CAMERA_CONFIG.fov"
        :near="CAMERA_CONFIG.near"
        :far="50000"
      />
      <OrbitControls make-default ref="controlsRef" enable-damping :damping-factor="0.05" />

      <TresAmbientLight :intensity="0.6" />
      <TresDirectionalLight :position="[50,50,50]" :intensity="1" />

      <TresGridHelper v-if="showGrid" :args="[gridSize, gridDivisions]" :position="gridPosition" />

  <primitive v-if="buildingModel" :object="buildingModel" />
  <primitive v-if="pathGroup" :object="pathGroup" />

    <!-- Camera frustum visualization (driven by ViewpointController) -->
    <CameraFrustum :cameraView="selectedViewpoint" :visible="showFrustum" />
    
    <!-- 航点相机朝向线段 - 使用primitive直接渲染Three.js Line对象 -->
    <primitive v-if="cameraDirectionLineObject" :object="cameraDirectionLineObject" />
    
    <!-- 航点编辑坐标系 Gizmo -->
    <WaypointGizmo
      v-if="selectedWaypointForEdit"
      ref="gizmoRef"
      :visible="true"
      :position="selectedWaypointForEdit.position as [number, number, number]"
      @axis-click="handleAxisClick"
      @axis-hover="handleAxisHover"
    />
    </TresCanvas>

  <!-- Building highlighter should live outside the TresCanvas to avoid mounting DOM inside the canvas -->
  <BuildingHighlighter :cameraView="selectedViewpoint" :buildingMesh="buildingModel" :visible="showFrustum" />

    <DroneLoading :visible="loading" :progress="loadingProgress" />

    <!-- Coordinate Axis Gizmo -->
    <AxisGizmo v-if="!loading" />

    <VisualizeControlPanel
      v-if="!loading"
      v-model="showPathLines"
      @reimport="goBack"
      @reset-view="resetCameraView"
    />

    <div class="kpi-panel-container" v-if="!loading">
      <KPIPanel v-if="showKpiPanel" ref="kpiPanelRef" :building-model="buildingModel" :recalculate-kpi="calculateKPIs" />
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch, nextTick, computed, markRaw } from 'vue'
import { useRouter } from '@fesjs/fes'
import { useDatasetStore } from '@/stores/dataset'
import { OrbitControls } from '@tresjs/cientos'
import {
  Object3D, Mesh, MeshBasicMaterial, 
  Group, Vector2, Vector3, SphereGeometry, InstancedMesh, Matrix4, LineBasicMaterial,
  BufferGeometry, BufferAttribute, Line, ConeGeometry, Quaternion,
  MeshStandardMaterial, Raycaster, DoubleSide
} from 'three'
import { OBJLoader } from 'three-stdlib'
import CameraFrustum from '@/features/visualization/components/CameraFrustum.vue'
import BuildingHighlighter from '@/features/visualization/components/BuildingHighlighter.vue'
import DroneLoading from '@/features/upload/components/DroneLoading.vue'
import VisualizeControlPanel from '@/features/visualization/components/VisualizeControlPanel.vue'
import AxisGizmo from '@/features/visualization/components/AxisGizmo.vue'
import WaypointGizmo from '@/features/visualization/components/WaypointGizmo.vue'

import { useKpiStore } from '@/stores/kpi'
import KPIPanel from '@/features/kpi/components/KPIPanel.vue'
import { CAMERA_CONFIG } from '@/shared/constants/constants'

// Composables
import { useLoadingProgress } from '@/features/upload/composables/useLoadingProgress'
import { useViewpoints } from '@/features/visualization/composables/useViewpoints'
import { useCameraController } from '@/features/visualization/composables/useCameraController'
import { BACKEND_CONFIG } from '@/shared/config/backend.config'


const router = useRouter()
const store = useDatasetStore()
    const kpiStore = useKpiStore()

// 模型数据缓存：记录是否已经上传过模型数据
const modelDataUploaded = ref(false)

// 控制KPI面板显示的状态（默认true）
const showKpiPanel = ref(true)
// 同步状态到store（确保KPIPanel内部能读取到）
kpiStore.toggleKpiPanel(true)


// 如果有任意数据缺失，显示警告但允许继续加载
if (!store.modelFiles.length || !store.pathFiles.length || !store.parsedPoints.length) {
  console.warn('数据不完整，但仍可继续加载可视化页面')
  console.warn('请在上传页面重新上传必要的文件')
}

/* scene state */
const state = reactive({ clearColor: '#000', alpha: false })
const cameraRef = ref()
const controlsRef = ref()

// 使用 useLoadingProgress composable
const { loading, loadingProgress, smoothProgress, setLoading, resetProgress } = useLoadingProgress()
// 初始化加载状态
setLoading(true)

const buildingModel = ref<Object3D | null>(null)
const pathGroup = ref<Group | null>(null)
const showPathLines = ref(true)
// Viewpoint / frustum UI state
const showFrustum = ref(false)
const selectedWaypointIndexForView = ref<number | null>(null) // 保存当前选中的航点索引
const selectedViewpoint = computed(() => {
  // 根据当前选中的航点索引，从viewpoints中获取对应的viewpoint
  if (selectedWaypointIndexForView.value === null || !viewpoints.value || viewpoints.value.length === 0) {
    return null
  }
  const idx = selectedWaypointIndexForView.value
  if (idx >= 0 && idx < viewpoints.value.length) {
    return viewpoints.value[idx]
  }
  return null
})

// 创建相机朝向线段对象（使用Three.js原生Line）
const cameraDirectionLineObject = computed(() => {
  if (!selectedViewpoint.value || !showFrustum.value) {
    return null
  }
  try {
    const pos = selectedViewpoint.value.position
    const dir = selectedViewpoint.value.direction
    if (!pos || !dir) {
      return null
    }
    const length = 15 // 减小长度，更合理
    const endPoint = {
      x: pos.x + dir.x * length,
      y: pos.y + dir.y * length,
      z: pos.z + dir.z * length
    }
    
    // 创建 Three.js Line 对象
    const geometry = new BufferGeometry()
    const positions = new Float32Array([
      pos.x, pos.y, pos.z,
      endPoint.x, endPoint.y, endPoint.z
    ])
    geometry.setAttribute('position', new BufferAttribute(positions, 3))
    
    const material = new LineBasicMaterial({
      color: 0x0077ff, // 蓝色
      linewidth: 5,
      depthTest: false, // 禁用深度测试，确保总是可见
      depthWrite: false,
    })
    
    const line = new Line(geometry, material)
    line.renderOrder = 2000 // 确保在其他对象之上渲染
    line.frustumCulled = false

    return markRaw(line)
  } catch (e) {
    return null
  }
})
// 使用 useViewpoints composable
const { viewpoints } = useViewpoints(() => store.parsedPoints)

function onViewpointSelected(v: any, index: number) {
  selectedWaypointIndexForView.value = index
  // optionally move camera/controls to viewpoint
  try {
    const c = cameraRef.value?.value
    const ctrl = controlsRef.value?.value
    if (c && v && v.position) {
      c.position.set(v.position.x + 20, v.position.y + 20, v.position.z + 20)
      if (ctrl) {
        ctrl.target.set(v.position.x, v.position.y, v.position.z)
        ctrl.update()
      }
    }
  } catch (e) {
    // ignore
  }
}

// 重置视角到默认位置
function resetCameraView() {
  console.log('重置相机视角')
  adjustCameraController(buildingModel.value, store.parsedPoints, controlsRef)
}


// 使用 useCameraController composable
const {
  cameraPosition,
  gridSize,
  gridDivisions,
  gridPosition,
  showGrid,
  updateGridFromModel,
  adjustCamera: adjustCameraController
} = useCameraController()

/* raycaster for click detection */
// const sceneRef = ref() // 未使用，已注释
const raycaster = new Raycaster()
const mouse = new Vector2()
let currentSelectedWaypoint: Mesh | null = null
let currentSelectedWaypointIndex: number | null = null // 保存选中航点的索引，用于重新渲染后恢复高亮

/* 航点选择状态 */
const selectedWaypointForEdit = ref<{ position: [number, number, number], index: number } | null>(null) // 选中的航点（用于显示gizmo和拖动）
const gizmoRef = ref() // Gizmo组件的引用

/* 拖动相关状态 */
const isDragging = ref(false) // 是否正在拖动
const dragAxis = ref<'x' | 'y' | 'z' | null>(null) // 当前拖动的轴
const dragStartPosition = ref<Vector3 | null>(null)
const dragStartMouse = ref<Vector2 | null>(null)
const hoveredAxis = ref<'x' | 'y' | 'z' | null>(null) // 鼠标悬停的轴

// 确保相机控制始终启用（除非正在拖动）
function ensureCameraControlsEnabled() {
  if (isDragging.value) return // 拖动时保持禁用
  
  nextTick(() => {
    if (controlsRef.value) {
      const controls = controlsRef.value.value || controlsRef.value
      if (controls) {
        controls.enabled = true
        if (controls.enableRotate !== undefined) controls.enableRotate = true
        if (controls.enablePan !== undefined) controls.enablePan = true
        if (controls.enableZoom !== undefined) controls.enableZoom = true
        // controls.update() // OrbitControls 可能没有 update 方法
      }
    }
  })
}

// 处理轴悬停
function handleAxisHover(axis: 'x' | 'y' | 'z' | null) {
  hoveredAxis.value = axis
}

// 获取鼠标样式
function getCursorStyle(): string {
  if (isDragging.value) {
    return 'grabbing' // 拖动中
  }
  if (hoveredAxis.value) {
    return 'grab' // 悬停在轴上，准备拖动
  }
  return 'default' // 默认（包括选中航点但未悬停在轴上）
}

// 处理轴点击（开始沿轴拖动）
function handleAxisClick(axis: 'x' | 'y' | 'z', event?: Event) {
  if (!selectedWaypointForEdit.value || !cameraRef.value) return
  
  // 阻止事件冒泡，防止触发相机控制
  if (event) {
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
  }
  
  dragAxis.value = axis
  isDragging.value = true
  
  // 立即禁用相机控制（不使用nextTick，立即执行）
  if (controlsRef.value) {
    const controls = controlsRef.value.value || controlsRef.value
    if (controls) {
      controls.enabled = false
      if (controls.enableRotate !== undefined) controls.enableRotate = false
      if (controls.enablePan !== undefined) controls.enablePan = false
      if (controls.enableZoom !== undefined) controls.enableZoom = false
      // controls.update() // OrbitControls 可能没有 update 方法
    }
  }
  
  const point = store.parsedPoints[selectedWaypointForEdit.value.index]
  if (point) {
    dragStartPosition.value = new Vector3(point.x, point.y, point.z)
    dragStartMouse.value = null // 重置鼠标起始位置
  }
}

// 统一的航点颜色设置函数
function highlightWaypoint(mesh: Mesh) {
  if (!mesh) return

  // 恢复之前选中的航点颜色和大小
  if (currentSelectedWaypoint && currentSelectedWaypoint !== mesh) {
    const prevIndex = currentSelectedWaypoint.userData.index
    const prevMaterial = currentSelectedWaypoint.material as MeshBasicMaterial
    if (prevIndex === 0) {
      prevMaterial.color.set(0x00ff00) // 绿色起点
    } else if (prevIndex === store.parsedPoints.length - 1) {
      prevMaterial.color.set(0xff0000) // 红色终点
    } else {
      prevMaterial.color.set(0x888888) // 灰色中间点
    }
  }

  // 高亮显示当前选中的航点 - 使用蓝色
  const material = mesh.material as MeshBasicMaterial
  material.color.set(0x0077ff) // 蓝色高亮
  material.needsUpdate = true
  currentSelectedWaypoint = mesh
  currentSelectedWaypointIndex = mesh.userData.index // 保存索引
}

function clearWaypointHighlight() {
  if (!currentSelectedWaypoint) return

  const prevIndex = currentSelectedWaypoint.userData.index
  const prevMaterial = currentSelectedWaypoint.material as MeshBasicMaterial
  if (prevIndex === 0) {
    prevMaterial.color.set(0x00ff00) // 绿色起点
  } else if (prevIndex === store.parsedPoints.length - 1) {
    prevMaterial.color.set(0xff0000) // 红色终点
  } else {
    prevMaterial.color.set(0x888888) // 灰色中间点
  }
  currentSelectedWaypoint = null
  currentSelectedWaypointIndex = null // 清除索引
}

// 清除所有选择状态（蓝色高亮、相机视角、高光、拍摄范围、坐标系）
function clearAllSelection() {
  selectedWaypointForEdit.value = null
  clearWaypointHighlight()
  selectedWaypointIndexForView.value = null
  showFrustum.value = false
  
  // 触发清除航点选择事件
  window.dispatchEvent(new CustomEvent('waypoint-cleared'))
}

function goBack(){
  console.log('执行重新导入，清空当前数据')
  // 释放资源
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
  
  if (pathGroup.value) {
    disposeGroup(pathGroup.value)
    pathGroup.value = null
  }
  
  // 清空所有数据后跳转
  store.resetAll()
  router.replace('/upload') 
}

/* ============ OBJ转GLB辅助函数 ============ */
// 取消 GLB 转换流程，直接解析 OBJ
function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsText(file)
  })
}

/* ============ 载入并转换OBJ模型 ============ */
async function loadObjModel() {
  console.log('开始加载OBJ模型...')

  try {
    const obj = store.modelFiles.find(f => f.name.toLowerCase().endsWith('.obj'))

    if (!obj) {
      console.error('没有找到OBJ文件')
      return
    }

    // 直接解析 OBJ 文本
    const objText = await readFileAsText(obj)

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

    // 分片处理模型，避免阻塞主线程
    const allChildren: any[] = []
    model.traverse((child: any) => allChildren.push(child))

    const chunkSize = 100 // 每批处理100个子对象
    let meshCount = 0
    let lineCount = 0

    for (let i = 0; i < allChildren.length; i += chunkSize) {
      const chunk = allChildren.slice(i, i + chunkSize)

      chunk.forEach((child: any) => {
        // 增强类型判断
        const isMesh = (child as any).isMesh ||
                       child.type === 'Mesh' ||
                       child instanceof Mesh ||
                       (child.constructor && child.constructor.name === 'Mesh')

        const isLine = (child as any).isLine ||
                       (child as any).isLineSegments ||
                       child.type === 'Line' ||
                       child.type === 'LineSegments' ||
                       child instanceof Line ||
                       (child.constructor && (child.constructor.name === 'Line' || child.constructor.name === 'LineSegments'))

        if (isMesh) {
          meshCount++
          if (!child.geometry.attributes.normal) {
            child.geometry.computeVertexNormals()
          }
          // 强制使用实心标准材质，双面渲染（DoubleSide）
          const solidMat = new MeshStandardMaterial({
            color: 0xcfd8dc,
            metalness: 0.1,
            roughness: 0.8,
            emissive: 0x111111,
            emissiveIntensity: 0.15,
            side: DoubleSide,
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

      // 每处理完一批，让出主线程
      await new Promise(resolve => setTimeout(resolve, 0))
    }

    console.log(`OBJ 解析统计 -> Mesh: ${meshCount}, Line/LineSegments: ${lineCount}`)

    buildingModel.value = markRaw(model)
  } catch (error) {
    console.error('建筑模型加载失败:', error)
    buildingModel.value = null
  }
}

/* ============ 路径绘制（简化的路径显示） ============ */
function disposeGroup(group: Group | null) {
  if (!group) return
  group.traverse((obj: any) => { obj.geometry?.dispose?.(); obj.material?.dispose?.() })
}

function renderPath() {
  // console.log('开始渲染路径...')
  // console.log('解析的路径点数量:', store.parsedPoints.length)

  // 检查路径点数据的有效性
  if (store.parsedPoints.length === 0) {
    // console.log('没有路径数据')
    disposeGroup(pathGroup.value)
    pathGroup.value = null
    return
  }

  // 检查路径点坐标是否有效

  // 计算路径点的坐标范围
  const points = store.parsedPoints.map(p => ({ x: p.x, y: p.y, z: p.z }))

  disposeGroup(pathGroup.value)
  const group = new Group()

  // 使用更大的球体尺寸，确保所有点都可见
  const sphere = new SphereGeometry(0.8, 16, 16)

  const createMarkerMaterial = (color: number) => new MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.95,
    depthTest: true, // 启用深度测试，让路径点能被建筑遮挡
    depthWrite: true, // 启用深度写入，确保正确的遮挡关系
  })

  // 为起点和终点创建独立材质
  const matStart = createMarkerMaterial(0x00ff00) // 绿色起点
  const matEnd = createMarkerMaterial(0xff0000)   // 红色终点
  // 中间点不再共享材质，每个点使用独立材质以便单独改变颜色

  // 起点 - 单独渲染
  if (points.length > 0) {
    const start = new Mesh(sphere, matStart)
    start.position.set(points[0].x, points[0].y, points[0].z)
    start.renderOrder = 1500
    start.userData = { isWaypoint: true, index: 0 } // 添加点击识别数据
    
    // 为起点添加点击事件
    start.addEventListener('click', () => {
      const index = 0

      // 设置高亮颜色
  highlightWaypoint(start)

  // 触发航点选择事件，通知KPIPanel
  window.dispatchEvent(new CustomEvent('waypoint-selected', {
    detail: { index: index }
  }))

  // 根据航点索引找到对应的viewpoint并显示视锥体
  if (viewpoints.value && viewpoints.value.length > index) {
    const viewpoint = viewpoints.value[index]

    // 确保viewpoint结构完整
    if (viewpoint && viewpoint.position && viewpoint.direction) {
      showFrustum.value = true
      onViewpointSelected(viewpoint, index)
    }
  }
    })
    
    group.add(start)
  }

  // 终点 - 单独渲染
  if (points.length > 1) {
    const end = new Mesh(sphere, matEnd)
    end.position.set(points[points.length - 1].x, points[points.length - 1].y, points[points.length - 1].z)
    end.renderOrder = 1500
    end.userData = { isWaypoint: true, index: points.length - 1 } // 添加点击识别数据
    
    // 为终点添加点击事件
    end.addEventListener('click', () => {
      const index = points.length - 1

      // 设置高亮颜色
      highlightWaypoint(end)

      // 触发航点选择事件，通知KPIPanel
      window.dispatchEvent(new CustomEvent('waypoint-selected', {
        detail: { index: index }
      }))

      // 根据航点索引找到对应的viewpoint并显示视锥体
      if (viewpoints.value && viewpoints.value.length > index) {
        const viewpoint = viewpoints.value[index]

        // 确保viewpoint结构完整
        if (viewpoint && viewpoint.position && viewpoint.direction) {
          showFrustum.value = true
          onViewpointSelected(viewpoint, index)
        }
      }
    })
    
    group.add(end)
  }

  // 中间点 - 每个点使用独立材质以便单独改变颜色
  if (points.length > 2) {
    const middlePoints = points.slice(1, -1)

    // console.log('开始渲染所有路径点...')

    for (let i = 0; i < middlePoints.length; i++) {
      const p = middlePoints[i]
      const pointIndex = i + 1 // 中间点从索引1开始

      // 每个中间点创建独立材质
      const matMid = createMarkerMaterial(0x888888) // 灰色中间点
      const mid = new Mesh(sphere, matMid)
      mid.position.set(p.x, p.y, p.z)
      mid.renderOrder = 1500
      mid.userData = { isWaypoint: true, index: pointIndex }
      
      // 为中间点添加点击事件
      mid.addEventListener('click', () => {
        const index = pointIndex

        // 设置高亮颜色
        highlightWaypoint(mid)

        // 触发航点选择事件，通知KPIPanel
        window.dispatchEvent(new CustomEvent('waypoint-selected', {
          detail: { index: index }
        }))

        // 根据航点索引找到对应的viewpoint并显示视锥体
        if (viewpoints.value && viewpoints.value.length > index) {
          const viewpoint = viewpoints.value[index]

          // 确保viewpoint结构完整
          if (viewpoint && viewpoint.position && viewpoint.direction) {
            showFrustum.value = true
            onViewpointSelected(viewpoint, index)
          }
        }
      })

      group.add(mid)
    }
  }

  // 线段 - 使用更粗的线条
  if (showPathLines.value && points.length >= 2) {
    const vertices = points.flatMap(p => [p.x, p.y, p.z])
    const geom = new BufferGeometry()
    geom.setAttribute('position', new BufferAttribute(new Float32Array(vertices), 3))
    
    // 使用灰色线条材质
    const lineMaterial = new LineBasicMaterial({ 
      color: 0x888888, // 灰色线条
      linewidth: 5, // 增加线宽
      depthTest: true, // 启用深度测试，让路径线能被建筑遮挡
      depthWrite: true, // 启用深度写入，确保正确的遮挡关系
    })
    
    const line = new Line(geom, lineMaterial)
    group.add(line)
    
    // 添加方向箭头 - 使用InstancedMesh优化性能
    const segCount = points.length - 1
    if (segCount > 0) {
      // 使用实例化网格提高性能
      const arrowGeometry = new ConeGeometry(0.6, 1.6, 12) // 固定大小
      const arrowMaterial = new MeshBasicMaterial({ 
        color: 0xf47920, // 橙色箭头
        depthTest: true, // 启用深度测试，让箭头能被建筑遮挡
        depthWrite: true, // 启用深度写入，确保正确的遮挡关系
        transparent: true,
        opacity: 0.9,
      })
      const arrows = new InstancedMesh(arrowGeometry, arrowMaterial, segCount)
      arrows.renderOrder = 1600
      
      const m = new Matrix4()
      const up = new Vector3(0, 1, 0) // 圆锥默认向上方向
      
      for (let i = 0; i < segCount; i++) {
        const p1 = new Vector3(points[i].x, points[i].y, points[i].z)
        const p2 = new Vector3(points[i+1].x, points[i+1].y, points[i+1].z)
        
        // 计算线段方向
        const dir = new Vector3().subVectors(p2, p1)
        const len = dir.length()
        if (len === 0) continue
        dir.normalize()
        
        // 使用四元数正确设置方向
        const q = new Quaternion().setFromUnitVectors(up, dir)
        
        // 箭头位置固定在离P1 5个单位距离处
        const fixedDistance = 5.0
        const arrowDistance = Math.min(fixedDistance, len * 0.8) // 确保不超过线段长度的80%
        const pos = new Vector3().copy(p1).addScaledVector(dir, arrowDistance)
        
        // 根据线段长度调整箭头大小
        const scale = new Vector3(1.0, Math.max(1.0, Math.min(2.5, len * 0.3)), 1.0)
        
        // 设置变换矩阵
        m.compose(pos, q, scale)
        arrows.setMatrixAt(i, m)
        
      }
      
      arrows.instanceMatrix.needsUpdate = true
      group.add(arrows)
    }
  }

  pathGroup.value = markRaw(group)
  
  // 如果在重新渲染前有选中的航点，重新应用高亮
  if (currentSelectedWaypointIndex !== null) {
    // 遍历group的子对象，找到索引匹配的航点Mesh
    group.traverse((child) => {
      if ((child as any).isMesh && (child as any).userData?.isWaypoint && (child as any).userData?.index === currentSelectedWaypointIndex) {
        const mesh = child as Mesh
        highlightWaypoint(mesh)
        return
      }
    })
  }
}

// 相机和网格控制已经通过 useCameraController composable 处理

  /* ============ 主流程 ============ */
  let loadingStartedFlag = false
  async function loadAll(){
    // 重置模型数据上传标记，新加载模型时需要重新上传
    modelDataUploaded.value = false
    if (loadingStartedFlag) {
      return
    }

    loadingStartedFlag = true
    setLoading(true)
    resetProgress()

  try {
    // 初始化 - 0-10%
    await smoothProgress(5, 150)
    await smoothProgress(10, 150)

    // 加载模型 - 10-40%
    const modelLoadPromise = loadObjModel()
    // 启动后立即更新到 20%
    await smoothProgress(20, 100)
    // 等待模型加载完成
    await modelLoadPromise
    // 模型加载完成，更新到 40%
    await smoothProgress(40, 200)

    // 渲染路径 - 40-60%
    renderPath()
    await smoothProgress(60, 200)

    // 注意：不在导入数据后加载历史记录
    // 历史记录只在用户修改数据时创建，是一次性的，不会保存到数据库
    // 用户关闭网站后历史记录就会消失
    await smoothProgress(65, 50)

    // 调整视图 - 65-70%
    await nextTick()
    updateGridFromModel(buildingModel.value)
    adjustCameraController(buildingModel.value, store.parsedPoints, controlsRef)
    await smoothProgress(70, 150)

    // 自动计算KPI数据 - 70-90%
    // 启动KPI计算，先更新到 75%
    await smoothProgress(75, 100)
    // 并行执行KPI计算和进度条更新
    const kpiPromise = calculateKPIs()
    // 在KPI计算过程中持续更新进度条到 90%
    await smoothProgress(85, 200)
    await smoothProgress(90, 200)
    // 等待KPI计算完成
    await kpiPromise

    // 完成收尾 - 90-100%

  } catch (error) {
    console.error('加载过程中出现错误:', error)
  } finally {
    // 完成进度到 100%
    await smoothProgress(100, 300)
    // 延迟一点时间，让用户看到 100%
    await new Promise(resolve => setTimeout(resolve, 300))
    setLoading(false)
    // 可视化完成后显示智能网格
    showGrid.value = true
    // 不再自动选择视点，等待用户点击航点
  }
}

// 提取第一个有效的Mesh几何体
function extractFirstValidMesh(model: any): any {
  if (!model) return null

  // 如果是Group对象，返回第一个有几何体的子对象
  if (model.isGroup && model.children && model.children.length > 0) {
    const validChild = model.children.find((child: any) => child.geometry && child.geometry.attributes?.position)
    return validChild || null
  }

  // 如果是Mesh对象，直接返回
  return model.geometry && model.geometry.attributes?.position ? model : null
}

/* ============ 自动计算KPI指标 ============ */
async function calculateKPIs() {
  try {
    // 开始计算
    kpiStore.startCalculation()

    // 使用 requestIdleCallback 或 setTimeout 让出主线程，避免阻塞UI
    await new Promise(resolve => {
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(() => resolve(undefined), { timeout: 100 })
      } else {
        setTimeout(() => resolve(undefined), 10)
      }
    })

    // 准备KPI计算参数，使用航点的实际normal向量
    const pathPoints = store.parsedPoints.map((point, index) => {
      // 获取实际的normal向量，如果没有则使用默认向下方向
      let normal = { x: 0, y: -1, z: 0 } // 默认向下

      if (point.normal && typeof point.normal === 'object') {
        const normalVec = {
          x: point.normal.x ?? 0,
          y: point.normal.y ?? 0,
          z: point.normal.z ?? 0
        }
        // 检查normal向量是否有效（非零向量）
        const normalLength = Math.sqrt(normalVec.x * normalVec.x + normalVec.y * normalVec.y + normalVec.z * normalVec.z)
        if (normalLength > 0.001) {
          // 归一化normal向量
          normal = {
            x: normalVec.x / normalLength,
            y: normalVec.y / normalLength,
            z: normalVec.z / normalLength
          }
        }
      }

      // 转换为后端期望的格式：WaypointData { x, y, z, normalX, normalY, normalZ }
      return {
        x: point.x,
        y: point.y,
        z: point.z,
        normalX: normal ? normal.x : null,
        normalY: normal ? normal.y : null,
        normalZ: normal ? normal.z : null
      }
    })

    if (pathPoints.length < 2) {
      console.warn('[KPI计算] 路径点数量不足，需要至少2个点')
      return
    }

    // 准备建筑模型数据
    // 优化：只在第一次计算时发送模型数据，后续使用后端缓存的模型
    let buildingMesh = null
    if (!modelDataUploaded.value && buildingModel.value) {
      // 第一次计算，提取并发送模型数据
      // 使用 requestIdleCallback 让出主线程，避免阻塞UI
      await new Promise(resolve => {
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(() => resolve(undefined), { timeout: 200 })
        } else {
          setTimeout(() => resolve(undefined), 20)
        }
      })
      
      const mesh = extractFirstValidMesh(buildingModel.value)
      if (mesh && mesh.geometry) {
        const geometry = mesh.geometry
        const positions = geometry.attributes.position.array
        const index = geometry.index ? geometry.index.array : null

        buildingMesh = {
          vertices: Array.from(positions),
          indices: index ? Array.from(index) : undefined
        }
        
        // 标记模型数据已上传
        modelDataUploaded.value = true
        console.log('[KPI计算] 首次上传模型数据，后续将使用缓存')
      }
    } else if (modelDataUploaded.value) {
      // 后续计算，不发送模型数据，使用后端缓存
      console.log('[KPI计算] 使用后端缓存的模型数据')
    }

    // 调用后端API进行KPI计算
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080'
    
    let response: Response
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), BACKEND_CONFIG.TIMEOUT)
      
      response = await fetch(`${backendUrl}/api/projects/1/kpi`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pathPoints,
        buildingMesh,
      }),
        signal: controller.signal,
    })
      
      clearTimeout(timeoutId)
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error('KPI计算请求超时，请检查后端服务是否正常运行')
      }
      if (error.message?.includes('Failed to fetch')) {
        throw new Error('无法连接到后端服务，请确保后端服务正在运行')
      }
      throw error
    }

    if (!response.ok) {
      let errorMessage = `KPI计算失败 (${response.status})`
      if (response.status === 500) {
        errorMessage = 'KPI计算失败：可能是模型数据未上传或数据格式问题。请先确保模型文件已成功上传。'
      } else if (response.status === 400) {
        errorMessage = 'KPI计算参数错误：请检查路径点数据是否正确。'
      } else {
        const errorText = await response.text().catch(() => response.statusText)
        if (errorText) {
          errorMessage += ` ${errorText}`
        }
      }
      throw new Error(errorMessage)
    }

    const kpiMetrics = await response.json()

    // 将计算结果存储到store中
    kpiStore.setKpiMetrics(kpiMetrics)

  } catch (error) {
    console.error('KPI calculation failed:', error)
    kpiStore.setError(error instanceof Error ? error.message : 'Calculation failed')
  }
}

// 简单的路径长度计算函数

onMounted(() => {
  loadAll()
  
  // 初始化时确保相机控制启用
  ensureCameraControlsEnabled()
})

// 监听 controlsRef 变化，确保相机控制状态正确
watch(controlsRef, (newControls) => {
  if (newControls) {
    nextTick(() => {
      ensureCameraControlsEnabled()
    })
  }
}, { immediate: true })

// 监听路径点变化，自动更新3D场景
watch(() => store.parsedPoints, () => {
  // 当路径点数据更新时，重新渲染路径
  if (store.parsedPoints.length > 0) {
    renderPath()
    
    // 如果有选中的航点，更新gizmo位置
    if (selectedWaypointForEdit.value) {
      const point = store.parsedPoints[selectedWaypointForEdit.value.index]
      if (point) {
        selectedWaypointForEdit.value.position = [point.x, point.y, point.z]
      }
    }
  }
}, { deep: true })

watch(showPathLines, (newValue) => {
  console.log('路径线显示状态:', newValue ? '显示' : '隐藏')
  renderPath()
})

  // 处理画布点击事件
function handleCanvasClick(event: MouseEvent) {
  if (!cameraRef.value || !pathGroup.value) return
  
  // 如果正在拖动，不处理点击事件
  if (isDragging.value) return
  
  // 计算鼠标在归一化设备坐标 (NDC) 中的位置
  const rect = (event.currentTarget as HTMLElement)?.getBoundingClientRect()
  if (!rect) return
  
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  
  // 更新射线投射器的原点和方向
  raycaster.setFromCamera(mouse, cameraRef.value)
  
  // 同时检测建筑物和航点
  const allIntersects: any[] = []
  
  // 检测建筑物
  if (buildingModel.value) {
    const buildingIntersects = raycaster.intersectObject(buildingModel.value, true)
    allIntersects.push(...buildingIntersects)
  }
  
  // 检测航点
  const waypointIntersects = raycaster.intersectObjects(pathGroup.value.children, true)
  allIntersects.push(...waypointIntersects)
  
  // 按距离排序，选择最近的
  allIntersects.sort((a, b) => a.distance - b.distance)
  
  let clickedWaypoint = false
  
  if (allIntersects.length > 0) {
    const closestIntersect = allIntersects[0]
    const intersectedObject = closestIntersect.object

      // 检查是否是航点
      if (intersectedObject.userData?.isWaypoint) {
      // 检查是否有建筑物遮挡（建筑物在航点之前，距离更近）
      const buildingBlocked = allIntersects.some(intersect => 
        intersect.distance < closestIntersect.distance &&
        !intersect.object.userData?.isWaypoint && 
        !intersect.object.userData?.axis
      )
      
      // 注意：航点选择逻辑已经在 handleMouseDown 中处理，这里不再重复处理
      // 避免重复触发 waypoint-selected 事件
        clickedWaypoint = true
    }
  }
  
  // 如果点击的不是航点，不处理（保持当前选择，只能通过点击另一个航点来切换）
}

// 处理鼠标按下事件 - 选择航点并准备拖动
function handleMouseDown(event: MouseEvent) {
  if (!cameraRef.value || !pathGroup.value) return
  
  const rect = (event.currentTarget as HTMLElement)?.getBoundingClientRect()
  if (!rect) return
  
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  
  raycaster.setFromCamera(mouse, cameraRef.value)
  
  // 同时检测建筑物和航点
  const allIntersects: any[] = []
  
  // 检测建筑物
  if (buildingModel.value) {
    const buildingIntersects = raycaster.intersectObject(buildingModel.value, true)
    allIntersects.push(...buildingIntersects)
  }
  
  // 检测航点
  const waypointIntersects = raycaster.intersectObjects(pathGroup.value.children, true)
  allIntersects.push(...waypointIntersects)
  
  // 检测gizmo（如果选中了航点）- 优先检测gizmo
  if (selectedWaypointForEdit.value && gizmoRef.value) {
    // 获取gizmo的group对象
    const gizmoGroup = gizmoRef.value.group?.value || gizmoRef.value.group || gizmoRef.value.value || gizmoRef.value
    if (gizmoGroup && typeof gizmoGroup.traverse === 'function') {
      // 遍历gizmo的所有子对象进行检测
      gizmoGroup.traverse((obj: any) => {
        if (obj.userData?.axis) {
          const gizmoIntersects = raycaster.intersectObject(obj, false)
          // 将gizmo的检测结果放在最前面，优先处理
          allIntersects.unshift(...gizmoIntersects)
        }
      })
    }
  }
  
  // 按距离排序，选择最近的
  allIntersects.sort((a, b) => a.distance - b.distance)
  
  if (allIntersects.length > 0) {
    const closestIntersect = allIntersects[0]
    const intersectedObject = closestIntersect.object
    
    // 检查是否点击了 gizmo 轴（优先处理）
    if (selectedWaypointForEdit.value && intersectedObject.userData?.axis) {
      handleAxisClick(intersectedObject.userData.axis, event)
      return
    }
    
    // 检查是否点击了航点本身
    if (intersectedObject.userData?.isWaypoint) {
      // 检查是否有建筑物遮挡（建筑物在航点之前，距离更近）
      const buildingBlocked = allIntersects.some(intersect => 
        intersect.distance < closestIntersect.distance &&
        !intersect.object.userData?.isWaypoint && 
        !intersect.object.userData?.axis
      )
      
      if (!buildingBlocked) {
        const index = intersectedObject.userData.index
        const point = store.parsedPoints[index]
        if (point) {
          selectedWaypointForEdit.value = {
            position: [point.x, point.y, point.z],
            index: index
          }
          highlightWaypoint(intersectedObject as Mesh)

          // 触发航点选择事件
        window.dispatchEvent(new CustomEvent('waypoint-selected', {
          detail: { index: index }
        }))

          // 显示视锥体和相机视角
        if (viewpoints.value && viewpoints.value.length > index) {
          const viewpoint = viewpoints.value[index]
          if (viewpoint && viewpoint.position && viewpoint.direction) {
            showFrustum.value = true
              selectedWaypointIndexForView.value = index
            onViewpointSelected(viewpoint, index)
          }
        }
        }
        event.preventDefault()
        event.stopPropagation()
      } else {
        // 被建筑物遮挡，不处理（保持当前选择）
        event.preventDefault()
        event.stopPropagation()
      }
    }
    // 点击了建筑物或其他物体，不处理（保持当前选择）
  }
  // 点击空白处，不处理（保持当前选择）
}

// 处理鼠标移动事件 - 单轴拖动
function handleMouseMove(event: MouseEvent) {
  // 只处理单轴拖动（拖动gizmo轴）
  if (!isDragging.value || !dragAxis.value || !cameraRef.value || !dragStartPosition.value || !selectedWaypointForEdit.value) return
  
  // 拖动时阻止事件冒泡，防止触发相机控制
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()
  
  // 确保相机控制被禁用（每次移动时都检查）
  if (controlsRef.value) {
    const controls = controlsRef.value.value || controlsRef.value
    if (controls) {
      controls.enabled = false
      if (controls.enableRotate !== undefined) controls.enableRotate = false
      if (controls.enablePan !== undefined) controls.enablePan = false
      if (controls.enableZoom !== undefined) controls.enableZoom = false
    }
  }
  
  const rect = (event.currentTarget as HTMLElement)?.getBoundingClientRect()
  if (!rect) return
  
  // 计算当前鼠标位置
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  
  // 获取轴方向向量（与全局坐标系统一）
  const axisVector = new Vector3()
  if (dragAxis.value === 'x') {
    axisVector.set(1, 0, 0)
  } else if (dragAxis.value === 'y') {
    axisVector.set(0, 1, 0)
  } else if (dragAxis.value === 'z') {
    axisVector.set(0, 0, -1) // Z轴指向负Z方向，与全局坐标系统一
  }
  
  // 计算鼠标移动在屏幕上的投影
  if (!dragStartMouse.value) {
    dragStartMouse.value = new Vector2(mouse.x, mouse.y)
    return
  }
  
  const deltaX = mouse.x - dragStartMouse.value.x
  const deltaY = mouse.y - dragStartMouse.value.y
  
  // 计算相机到航点的距离，用于调整灵敏度
  const distanceToWaypoint = cameraRef.value.position.distanceTo(dragStartPosition.value)
  const sensitivity = distanceToWaypoint * 0.01
  
  // 计算相机右向量和上向量
  const cameraRight = new Vector3()
  const cameraUp = new Vector3()
  cameraRight.setFromMatrixColumn(cameraRef.value.matrixWorld, 0).normalize()
  cameraUp.setFromMatrixColumn(cameraRef.value.matrixWorld, 1).normalize()
  
  // 计算鼠标移动在屏幕上的向量
  const screenMove = new Vector3()
  screenMove.addScaledVector(cameraRight, deltaX * sensitivity)
  screenMove.addScaledVector(cameraUp, -deltaY * sensitivity)

  // 将屏幕移动投影到轴方向上
  const axisProjection = screenMove.dot(axisVector)
  const moveVector = axisVector.clone().multiplyScalar(axisProjection)
  
  // 计算新位置
  const newPosition = dragStartPosition.value.clone().add(moveVector)
  
  // 更新航点位置
  updateWaypointPosition(newPosition)
  
  // 更新gizmo位置
  selectedWaypointForEdit.value.position = [newPosition.x, newPosition.y, newPosition.z]
}

// 更新航点位置的辅助函数
function updateWaypointPosition(newPosition: Vector3) {
  if (!selectedWaypointForEdit.value) return
  
  const point = store.parsedPoints[selectedWaypointForEdit.value.index]
  if (!point) return
  
  // 更新store中的位置
  store.updatePointPosition(point.id, newPosition.x, newPosition.y, newPosition.z)
  
  // 实时更新3D场景中的航点位置
  if (currentSelectedWaypoint) {
    currentSelectedWaypoint.position.set(newPosition.x, newPosition.y, newPosition.z)
  }
  
  // 实时更新路径线（如果显示）- 只更新线段，不重新渲染整个路径
  if (showPathLines.value && pathGroup.value) {
    // 找到路径线对象并更新其顶点
    pathGroup.value.traverse((child) => {
      if (child instanceof Line && child.geometry) {
        const positions = child.geometry.attributes.position
        if (positions) {
          // 更新相邻的顶点
          const points = store.parsedPoints
          const vertices: number[] = []
          points.forEach(p => {
            vertices.push(p.x, p.y, p.z)
          })
          positions.array = new Float32Array(vertices)
          positions.needsUpdate = true
        }
      }
    })
  }
}

// 处理鼠标释放事件 - 结束拖动
function handleMouseUp(event: MouseEvent) {
  endDragging()
}

// 处理鼠标离开画布事件
function handleMouseLeave(event: MouseEvent) {
  endDragging()
}

// 结束拖动的辅助函数
function endDragging() {
  if (isDragging.value) {
    isDragging.value = false
    dragAxis.value = null
    dragStartPosition.value = null
    dragStartMouse.value = null
    
    // 拖动结束后，重新渲染路径以确保所有连接线和箭头更新
    if (store.parsedPoints.length > 0) {
      renderPath()
      
      // 更新gizmo位置
      if (selectedWaypointForEdit.value) {
        const point = store.parsedPoints[selectedWaypointForEdit.value.index]
        if (point) {
          selectedWaypointForEdit.value.position = [point.x, point.y, point.z]
        }
      }
    }
    
    // 拖动结束后，恢复相机控制
    ensureCameraControlsEnabled()
  }
  
  // 拖动结束后，清除悬停状态
  hoveredAxis.value = null
}

function onLoop(){
  // 发送相机更新事件给坐标系指示器
  if (cameraRef.value && controlsRef.value) {
    window.dispatchEvent(new CustomEvent('camera-update', {
      detail: {
        quaternion: cameraRef.value.quaternion.clone()
      }
    }))
  }
}

// 暴露给KPIPanel使用的方法
defineExpose({
  recalculateKpi: calculateKPIs
})
</script>


<style scoped>
.viewer-container { 
  position: fixed; 
  top: 0; 
  left: 0; 
  width: 100vw; 
  height: 100vh; 
  background: #000000; 
  overflow: hidden; 
}

/* KPI Panel */
.kpi-panel-container {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 1001;
}

</style>