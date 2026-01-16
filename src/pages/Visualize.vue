<template>
  <div class="viewer-container">
    
    <TresCanvas v-bind="state" window-size @loop="onLoop" @click="handleCanvasClick">
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
    </TresCanvas>

  <!-- Building highlighter should live outside the TresCanvas to avoid mounting DOM inside the canvas -->
  <BuildingHighlighter :cameraView="selectedViewpoint" :buildingMesh="buildingModel" :visible="showFrustum" />

    <DroneLoading :visible="loading" :progress="loadingProgress" />

    
    <VisualizeControlPanel
      v-if="!loading"
      v-model="showPathLines"
      @reimport="goBack"
    />

    <div class="kpi-panel-container" v-if="!loading">
      <KPIPanel v-if="showKpiPanel" :building-model="buildingModel" />
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

import { useKpiStore } from '@/stores/kpi'
import { calculateAllKPIs } from '@/features/kpi/services/kpi-calculator'
import KPIPanel from '@/features/kpi/components/KPIPanel.vue'
import { CAMERA_CONFIG } from '@/shared/constants/constants'

// Composables
import { useLoadingProgress } from '@/features/upload/composables/useLoadingProgress'
import { useViewpoints } from '@/features/visualization/composables/useViewpoints'
import { useCameraController } from '@/features/visualization/composables/useCameraController'


const router = useRouter()
const store = useDatasetStore()
    const kpiStore = useKpiStore()

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
const selectedViewpoint = ref<any | null>(null)

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

function onViewpointSelected(v: any) {
  selectedViewpoint.value = v
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
      selectedViewpoint.value = viewpoint
      showFrustum.value = true
      onViewpointSelected(viewpoint)
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
          selectedViewpoint.value = viewpoint
          showFrustum.value = true
          onViewpointSelected(viewpoint)
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
            selectedViewpoint.value = viewpoint
            showFrustum.value = true
            onViewpointSelected(viewpoint)
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

    // 调整视图 - 60-70%
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

/* ============ 自动计算KPI指标 ============ */
async function calculateKPIs() {
  try {
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

      return {
        id: index,
        position: point,
        normal
      }
    })

    if (pathPoints.length < 2) {
      return
    }

    // 调用KPI计算服务
    const kpiParams = {
      pathPoints,
      buildingMesh: buildingModel.value
    }

    const kpiMetrics = await calculateAllKPIs(kpiParams)

    // 将计算结果存储到store中
    kpiStore.setKpiMetrics(kpiMetrics)

  } catch (error) {
    console.error('KPI计算失败:', error)
  }
}

// 简单的路径长度计算函数

onMounted(() => {
  loadAll()
})
watch(showPathLines, (newValue) => {
  console.log('路径线显示状态:', newValue ? '显示' : '隐藏')
  renderPath()
})

  // 处理画布点击事件
function handleCanvasClick(event: MouseEvent) {
  if (!cameraRef.value || !pathGroup.value) return
  
  // 计算鼠标在归一化设备坐标 (NDC) 中的位置
  const rect = (event.currentTarget as HTMLElement)?.getBoundingClientRect()
  if (!rect) return
  
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  
  // 更新射线投射器的原点和方向
  raycaster.setFromCamera(mouse, cameraRef.value)
  
  // 检测与路径点的交集
  const intersects = raycaster.intersectObjects(pathGroup.value.children, true)
  
  let clickedWaypoint = false
  
    if (intersects.length > 0) {
      const intersectedObject = intersects[0].object

      // 检查是否是航点
      if (intersectedObject.userData?.isWaypoint) {
        clickedWaypoint = true
        const index = intersectedObject.userData.index

        // 触发航点选择事件，通知KPIPanel
        window.dispatchEvent(new CustomEvent('waypoint-selected', {
          detail: { index: index }
        }))

        // 根据航点索引找到对应的viewpoint并显示视锥体
        if (viewpoints.value && viewpoints.value.length > index) {
          const viewpoint = viewpoints.value[index]

          // 确保viewpoint结构完整
          if (viewpoint && viewpoint.position && viewpoint.direction) {
            selectedViewpoint.value = viewpoint
            showFrustum.value = true
            onViewpointSelected(viewpoint)
          }
        }
      
      // 高亮显示当前选中的航点
      const mesh = intersectedObject as Mesh
      highlightWaypoint(mesh)
    }
  }
  
  // 如果点击的不是航点，清除选择
  if (!clickedWaypoint && currentSelectedWaypoint) {
    clearWaypointHighlight()
    
    // 清除视锥体显示
    selectedViewpoint.value = null
    showFrustum.value = false
    
    // 触发清除航点选择事件
    window.dispatchEvent(new CustomEvent('waypoint-cleared'))
  }
}

function onLoop(){}
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