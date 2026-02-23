<template>
  <div class="viewer-container">
    
    <TresCanvas 
      v-bind="state" 
      window-size 
      @loop="onLoop" 
      @click="handleCanvasClick"
      @mousedown="handleMouseDown"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseLeave"
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

      <TresGroup>
        <primitive 
          v-if="buildingModel" 
          :object="buildingModel" 
        />

        <primitive v-if="pathGroup" :object="pathGroup" />

        <PlaybackRenderer />
      </TresGroup>

      <CameraFrustum :cameraView="transformedViewpoint" :visible="showFrustum || store.isPlaybackMode" :buildingMesh="buildingModel" />
      <primitive v-if="cameraDirectionLineObject" :object="cameraDirectionLineObject" />

    </TresCanvas>

    <BuildingHighlighter
      :camera-view="store.isPlaybackMode ? null : transformedViewpoint"
      :all-viewpoints="store.isPlaybackMode ? null : (showAllCoverageHighlight ? allViewpointsForHighlight : null)"
      :playback-past-viewpoints="playbackPastViewpoints"
      :playback-current-viewpoint="playbackCurrentViewpoint"
      :prefetch-past-viewpoints="prefetchPastViewpoints"
      :prefetch-current-viewpoint="prefetchCurrentViewpoint"
      :playback-paused="store.isPaused"
      :preload-requested="preloadRequested"
      :preload-viewpoints="preloadViewpoints"
      :building-mesh="buildingModel"
      :visible="showFrustum || showAllCoverageHighlight || store.isPlaybackMode"
      @highlight-loading="(v: boolean) => highlightLoading = v"
      @highlight-loading-progress="(loaded, total) => { highlightProgress = total > 0 ? Math.round((loaded / total) * 100) : 0 }"
      @playback-coverage="onPlaybackCoverage"
      @preload-progress="onPreloadProgress"
      @preload-complete="onPreloadComplete"
    />

    <DroneLoading
      :visible="highlightLoading"
      :show-progress="true"
      :progress="highlightProgress"
      loading-text="Loading Coverage Highlight..."
      :dimmed="true"
    />

    <DroneLoading
      :visible="preloadRequested"
      :show-progress="true"
      :progress="Math.round(preloadProgress * 100)"
      loading-text="Preparing playback..."
      :dimmed="true"
    />

    <DroneLoading
      :visible="kpiStore.isCalculating"
      :show-progress="false"
      loading-text="Calculating..."
      :dimmed="true"
    />

    <DroneLoading :visible="loading" :show-progress="true" :progress="loadingProgress" />

    <AxisGizmo v-if="!loading" />

    <WaypointListPanel
      v-if="!loading"
      :disabled="store.isPlaybackMode"
      :is-playback-mode="store.isPlaybackMode"
      :selected-waypoint-index="selectedWaypointForEdit?.index ?? null"
      :waypoints="store.parsedPoints"
      @select-waypoint="(index) => onViewpointSelectedFromList(index)"
    />

    <VisualizeControlPanel
      v-if="!loading"
      v-model="showPathLines"
      :disabled="store.isPlaybackMode"
      :selected-waypoint-index="selectedWaypointForEdit?.index ?? null"
      @save="handleSaveToBackend"
      @home="goHome"
      @reset-view="resetCameraView"
      @insert-before="onInsertPointBefore"
      @insert-after="onInsertPointAfter"
      @delete="onDeletePoint"
      @optimize="onOptimizePath"
    />

    <div class="kpi-panel-container" v-if="!loading">
      <KPIPanel v-if="showKpiPanel" ref="kpiPanelRef" :building-model="buildingModel" :recalculate-kpi="calculateKPIs" :fetch-playback-coverage="fetchPlaybackCoverage" :show-all-coverage-highlight="showAllCoverageHighlight" :on-play-request="handlePlayRequest" @view-all-coverage="toggleAllCoverageHighlight" />
    </div>

    <PlaybackTimeline v-if="!loading && store.isPlaybackMode" class="playback-timeline-overlay" />

    <ConfirmDialog
      v-model:visible="deleteDialogVisible"
      :message="deleteDialogMessage"
      @confirm="handleDeleteDialogConfirm"
      @cancel="handleDeleteDialogCancel"
    />

    <ConfirmDialog
      v-model:visible="optimizeDialogVisible"
      :message="optimizeDialogMessage"
      :show-cancel="optimizeDialogShowCancel"
      :confirm-label="optimizeDialogConfirmLabel"
      @confirm="handleOptimizeDialogConfirm"
      @cancel="handleOptimizeDialogCancel"
    />

    <WelcomeGuide v-if="!loading" :visible="showWelcomeGuide" @dismiss="showWelcomeGuide = false" />

    <DroneLoading
      v-if="saveMessage === 'saving'"
      :visible="true"
      loading-text="Saving..."
      :show-progress="false"
      :dimmed="true"
    />
    <div v-else-if="saveMessage" class="save-status-overlay">
      <div class="save-status-container">
        <div class="save-status-icon" :class="saveMessage">
          {{ saveMessage === 'saved' ? '✓' : '✕' }}
        </div>
        <p class="save-status-text">{{ saveMessage === 'saved' ? 'Saved successfully' : 'Save failed' }}</p>
        <p v-if="saveErrorMessage" class="save-error-detail">{{ saveErrorMessage }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch, nextTick, computed, markRaw } from 'vue'
import { useRouter, useRoute } from '@fesjs/fes'
import { useDatasetStore } from '@/stores/dataset'
import { useAuthStore } from '@/stores/auth'
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
import WelcomeGuide from '@/features/visualization/components/WelcomeGuide.vue'
import DroneLoading from '@/features/upload/components/DroneLoading.vue'
import VisualizeControlPanel from '@/features/visualization/components/VisualizeControlPanel.vue'
import WaypointListPanel from '@/features/visualization/components/WaypointListPanel.vue'
import AxisGizmo from '@/features/visualization/components/AxisGizmo.vue'
import ConfirmDialog from '@/features/shared/components/ConfirmDialog.vue'
import { useConfirmDialog } from '@/features/shared/composables/useConfirmDialog'
import PlaybackRenderer from '@/features/visualization/components/PlaybackRenderer.vue'
import PlaybackTimeline from '@/features/visualization/components/PlaybackTimeline.vue'
import { useKpiStore } from '@/stores/kpi'
import KPIPanel from '@/features/kpi/components/KPIPanel.vue'
import { CAMERA_CONFIG } from '@/shared/constants/constants'

// Composables
import { useLoadingProgress } from '@/features/upload/composables/useLoadingProgress'
import { useViewpoints } from '@/features/visualization/composables/useViewpoints'
import { useCameraController } from '@/features/visualization/composables/useCameraController'
import { BACKEND_CONFIG } from '@/shared/config/backend.config'
import { extractAllMeshData, computeCoverageFromFaceIndices } from '@/shared/utils/mesh-utils'
import { saveProjectData, loadModelData, loadWaypoints, getOrCreateProject } from '@/shared/services/projectDataService'
import { calculatePathCoverageFrontend, computeVisibleFacesForPoint } from '@/shared/services/coverage-calculator'

const router = useRouter()
const route = useRoute()
const store = useDatasetStore()
const authStore = useAuthStore()
const kpiStore = useKpiStore()

const {
  dialogVisible: deleteDialogVisible,
  dialogMessage: deleteDialogMessage,
  showConfirmDialog: showDeleteConfirmDialog,
  handleConfirm: handleDeleteDialogConfirm,
  handleCancel: handleDeleteDialogCancel
} = useConfirmDialog()

const {
  dialogVisible: optimizeDialogVisible,
  dialogMessage: optimizeDialogMessage,
  dialogShowCancel: optimizeDialogShowCancel,
  dialogConfirmLabel: optimizeDialogConfirmLabel,
  showConfirmDialog: showOptimizeConfirmDialog,
  handleConfirm: handleOptimizeDialogConfirm,
  handleCancel: handleOptimizeDialogCancel
} = useConfirmDialog()

// 模型数据缓存（用于 KPI 请求）
const modelDataUploaded = ref(false)
/** 模型是否已成功保存到后端（用于编辑路径后仅保存航点） */
const modelSavedToBackend = ref(false)

const showKpiPanel = ref(true)
kpiStore.toggleKpiPanel(true)


if (!store.modelFiles.length || !store.pathFiles.length || !store.parsedPoints.length) {
  console.warn('数据不完整，但仍可继续加载可视化页面')
}

/* scene state */
const state = reactive({ clearColor: '#000', alpha: false })
const cameraRef = ref()
const controlsRef = ref()

const { loading, loadingProgress, smoothProgress, setLoading, resetProgress } = useLoadingProgress()
setLoading(true)

const buildingModel = ref<Object3D | null>(null)
const pathGroup = ref<Group | null>(null)
const showPathLines = ref(true)
const showFrustum = ref(false)
const selectedWaypointIndexForView = ref<number | null>(null) 
const selectedWaypointForEdit = ref<{ position: [number, number, number], index: number } | null>(null)

const { viewpoints } = useViewpoints(() => store.parsedPoints)

const selectedViewpoint = computed(() => {
  if (selectedWaypointIndexForView.value === null || !viewpoints.value || viewpoints.value.length === 0) {
    return null
  }
  const idx = selectedWaypointIndexForView.value
  if (idx >= 0 && idx < viewpoints.value.length) {
    return viewpoints.value[idx]
  }
  return null
})

/** 播放模式下的当前视点（基于 playbackIndex） */
const playbackViewpoint = computed(() => {
  if (!store.isPlaybackMode || !viewpoints.value || viewpoints.value.length === 0) return null
  const idx = Math.min(Math.floor(store.playbackIndex), viewpoints.value.length - 1)
  if (idx < 0) return null
  return viewpoints.value[idx]
})

const toCameraView = (v: any) => ({
  position: v.position,
  direction: v.direction,
  up: v.up ?? { x: 0, y: 0, z: 1 },
  fov: v.fov ?? CAMERA_CONFIG.fov,
  aspect: v.aspect ?? 16 / 9,
  near: v.near ?? 0.1,
  far: v.far ?? 20,
})

/** 仅在航点切换时更新，减少高亮计算频率，支持播放时拖动视角 */
const stablePlaybackPastViewpoints = ref<ReturnType<typeof toCameraView>[] | null>(null)
const stablePlaybackCurrentViewpoint = ref<ReturnType<typeof toCameraView> | null>(null)
watch(
  () => (store.isPlaybackMode ? Math.floor(store.playbackIndex) : -1),
  (floor) => {
    if (!store.isPlaybackMode || !viewpoints.value) {
      stablePlaybackPastViewpoints.value = null
      stablePlaybackCurrentViewpoint.value = null
      return
    }
    if (floor <= 0) {
      stablePlaybackPastViewpoints.value = []
      stablePlaybackCurrentViewpoint.value = viewpoints.value[0] ? toCameraView(viewpoints.value[0]) : null
      return
    }
    stablePlaybackPastViewpoints.value = viewpoints.value.slice(0, floor).map(toCameraView)
    const curr = viewpoints.value[Math.min(floor, viewpoints.value.length - 1)]
    stablePlaybackCurrentViewpoint.value = curr ? toCameraView(curr) : null
  },
  { immediate: true },
)

/** 播放模式：已飞过的视点（稳定引用，仅航点切换时变） */
const playbackPastViewpoints = computed(() => stablePlaybackPastViewpoints.value)

/** 播放模式：当前视点（稳定引用） */
const playbackCurrentViewpoint = computed(() => stablePlaybackCurrentViewpoint.value)

/** 预取：倍速越高越早触发，留足时间减少滞后 */
const prefetchPastViewpoints = ref<ReturnType<typeof toCameraView>[] | null>(null)
const prefetchCurrentViewpoint = ref<ReturnType<typeof toCameraView> | null>(null)
let lastPrefetchFloor = -1
watch(
  () => [store.isPlaybackMode ? store.playbackIndex : -1, store.playbackSpeed] as const,
  ([idx]) => {
    if (!store.isPlaybackMode || !viewpoints.value || idx < 0) {
      prefetchPastViewpoints.value = null
      prefetchCurrentViewpoint.value = null
      lastPrefetchFloor = -1
      return
    }
    const floor = Math.floor(idx)
    const alpha = idx - floor
    const threshold = store.playbackSpeed >= 2.5 ? 0.04 : store.playbackSpeed >= 2 ? 0.06 : store.playbackSpeed >= 1.5 ? 0.1 : 0.2
    if (alpha > threshold && floor + 1 < viewpoints.value!.length && lastPrefetchFloor !== floor) {
      lastPrefetchFloor = floor
      prefetchPastViewpoints.value = viewpoints.value!.slice(0, floor + 1).map(toCameraView)
      const next = viewpoints.value![floor + 1]
      prefetchCurrentViewpoint.value = next ? toCameraView(next) : null
    } else if (alpha <= threshold || floor + 1 >= viewpoints.value!.length) {
      prefetchPastViewpoints.value = null
      prefetchCurrentViewpoint.value = null
      lastPrefetchFloor = -1
    }
  },
  { immediate: true },
)

const transformedViewpoint = computed(() =>
  store.isPlaybackMode ? playbackViewpoint.value : selectedViewpoint.value
)

// 全部视点覆盖率高亮（点击 KPI 面板 [View] 时切换）
const showAllCoverageHighlight = ref(false)
const highlightLoading = ref(false)
const highlightProgress = ref(0)

// 播放结束/停止时退出 [View] 状态，并选中当前航点
watch(
  () => store.isPlaybackMode,
  (isPlaying, wasPlaying) => {
    if (wasPlaying && !isPlaying) {
      if (showAllCoverageHighlight.value) showAllCoverageHighlight.value = false
      const idx = Math.floor(store.playbackIndex)
      const pts = store.parsedPoints
      if (pts.length > 0 && idx >= 0 && idx < pts.length) {
        const vp = viewpoints.value?.[idx]
        if (vp?.position) {
          onViewpointSelected(vp, idx)
        } else {
          const point = pts[idx]
          selectedWaypointForEdit.value = { position: [point.x, point.y, point.z], index: idx }
          selectedWaypointIndexForView.value = idx
          showFrustum.value = true
          window.dispatchEvent(new CustomEvent('waypoint-selected', { detail: { index: idx } }))
          nextTick(() => {
            if (pathGroup.value) {
              pathGroup.value.traverse((obj: any) => {
                if (obj.userData?.isWaypoint && obj.userData?.index === idx) {
                  highlightWaypoint(obj as Mesh)
                }
              })
            }
          })
        }
      }
    }
  },
)

/** 播放前预加载：建筑高亮 + 前端覆盖率计算，播放时只读缓存不卡顿 */
const preloadRequested = ref(false)
const preloadViewpoints = ref<ReturnType<typeof toCameraView>[] | null>(null)
const preloadProgress = ref(0)
let buildingPreloadResolve: (() => void) | null = null
function onPreloadProgress(loaded: number, total: number) {
  preloadProgress.value = total > 0 ? (loaded / total) * 0.5 : 0.5
}
function onPreloadComplete() {
  buildingPreloadResolve?.()
  buildingPreloadResolve = null
}
async function handlePlayRequest() {
  if (!buildingModel.value || !viewpoints.value || viewpoints.value.length === 0) return
  if (store.isPlaybackMode) return
  preloadRequested.value = true
  preloadViewpoints.value = viewpoints.value.map(toCameraView)
  preloadProgress.value = 0
  playbackCoverageCache.clear()

  const buildingPromise = new Promise<void>((r) => { buildingPreloadResolve = r })
  const coveragePromise = preloadCoverageFrontend((loaded, total) => {
    if (total > 0) preloadProgress.value = 0.5 + (loaded / total) * 0.5
  })

  await Promise.all([buildingPromise, coveragePromise])

  preloadRequested.value = false
  preloadViewpoints.value = null
  preloadProgress.value = 1
}

/** 预加载覆盖率：优先后端批量接口（与 KPI 完全一致），失败时回退前端计算。
 * 累计逻辑：cumulative(N) = cumulative(N-1) ∪ faces(waypoint N)，与可视化单点覆盖率同源算法 */
async function preloadCoverageFrontend(onProgress?: (loaded: number, total: number) => void): Promise<void> {
  const pts = store.parsedPoints
  if (pts.length < 2 || !buildingModel.value) return
  const total = pts.length
  onProgress?.(0, total)

  const pathPoints = pts.map((p) => {
    let normal = { x: 0, y: -1, z: 0 }
    if (p.normal) {
      const n = p.normal
      const len = Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z)
      if (len > 0.001) normal = { x: n.x / len, y: n.y / len, z: n.z / len }
    }
    return { x: p.x, y: p.y, z: p.z, normalX: normal.x, normalY: normal.y, normalZ: normal.z }
  })
  const meshData = extractAllMeshData(buildingModel.value)
  const buildingMesh = meshData
    ? {
        vertices: meshData.vertices,
        indices: meshData.indices && meshData.indices.length > 0 ? meshData.indices : undefined,
      }
    : null

  try {
    const projId = store.currentProjectId || BACKEND_CONFIG.DEFAULT_PROJECT_ID
    const res = await fetch(
      `${BACKEND_CONFIG.BASE_URL}/api/projects/${projId}/coverage-batch`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pathPoints, buildingMesh }),
      },
    )
    if (res.ok) {
      const map: Record<string, number> = await res.json()
      for (const [k, v] of Object.entries(map)) {
        const n = parseInt(k, 10)
        if (Number.isFinite(n) && Number.isFinite(v)) playbackCoverageCache.set(n, v)
      }
      const lastCov = playbackCoverageCache.get(pts.length)
      console.info('[preloadCoverage] 使用后端批量接口，终点覆盖率:', lastCov != null ? `${lastCov.toFixed(1)}%` : 'N/A')
      onProgress?.(total, total)
      return
    }
    console.warn('[preloadCoverage] 后端返回', res.status, await res.text().catch(() => ''))
  } catch (e) {
    console.warn('[preloadCoverage] 后端批量失败，回退前端计算:', e)
  }

  const flatMesh =
    meshData && buildingMesh
      ? { vertices: buildingMesh.vertices, indices: buildingMesh.indices }
      : null
  if (!flatMesh || !meshData || meshData.vertices.length < 9) return
  console.info('[preloadCoverage] Using frontend incremental calculation (same algorithm as KPI)')
  const n = meshData.vertices.length / 3
  let cx = 0,
    cy = 0,
    cz = 0
  for (let i = 0; i < n; i++) {
    cx += meshData.vertices[i * 3]
    cy += meshData.vertices[i * 3 + 1]
    cz += meshData.vertices[i * 3 + 2]
  }
  const buildingCenter = { x: cx / n, y: cy / n, z: cz / n }
  const coveredFaces = new Set<number>()
  let idx = 0
  const BATCH = 64
  await new Promise<void>((resolve) => {
    const runBatch = () => {
      const end = Math.min(idx + BATCH, pts.length)
      for (let i = idx; i < end; i++) {
        const p = pts[i]
        const pathPoint = { x: p.x, y: p.y, z: p.z, normal: p.normal }
        const faces = computeVisibleFacesForPoint(pathPoint, flatMesh, buildingCenter)
        faces.forEach((f) => coveredFaces.add(f))
        const cov = computeCoverageFromFaceIndices(meshData, Array.from(coveredFaces))
        if (Number.isFinite(cov)) playbackCoverageCache.set(i + 1, Math.max(0, Math.min(100, cov)))
      }
      idx = end
      onProgress?.(idx, total)
      if (idx < pts.length) requestAnimationFrame(runBatch)
      else {
        onProgress?.(total, total)
        resolve()
      }
    }
    requestAnimationFrame(runBatch)
  })
}

// 加载完成后显示欢迎说明
const showWelcomeGuide = ref(false)
const allViewpointsForHighlight = computed(() => {
  if (!viewpoints.value || viewpoints.value.length === 0) return []
  return viewpoints.value.map(v => ({
    position: v.position,
    direction: v.direction,
    up: v.up ?? { x: 0, y: 0, z: 1 },
    fov: v.fov ?? CAMERA_CONFIG.fov,
    aspect: v.aspect ?? 16 / 9,
    near: v.near ?? 0.1,
    far: v.far ?? 20,
  }))
})
function toggleAllCoverageHighlight() {
  const turningOn = !showAllCoverageHighlight.value
  showAllCoverageHighlight.value = turningOn
  if (turningOn) {
    clearWaypointSelection()
  }
}

const cameraDirectionLineObject = computed(() => {
  if (!transformedViewpoint.value || (!showFrustum.value && !store.isPlaybackMode)) {
    return null
  }
  try {
    const pos = transformedViewpoint.value.position
    const dir = transformedViewpoint.value.direction
    if (!pos || !dir) return null
    const px = typeof pos.x === 'number' && Number.isFinite(pos.x) ? pos.x : 0
    const py = typeof pos.y === 'number' && Number.isFinite(pos.y) ? pos.y : 0
    const pz = typeof pos.z === 'number' && Number.isFinite(pos.z) ? pos.z : 0
    const dx = typeof dir.x === 'number' && Number.isFinite(dir.x) ? dir.x : 0
    const dy = typeof dir.y === 'number' && Number.isFinite(dir.y) ? dir.y : 0
    const dz = typeof dir.z === 'number' && Number.isFinite(dir.z) ? dir.z : 0
    const length = 15
    const endPoint = {
      x: px + dx * length,
      y: py + dy * length,
      z: pz + dz * length,
    }
    const positions = new Float32Array([px, py, pz, endPoint.x, endPoint.y, endPoint.z])
    if (positions.byteLength === 0) return null
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(positions, 3))
    
    const material = new LineBasicMaterial({
      color: COLOR_CURRENT,
      linewidth: 5,
      depthTest: true,
      depthWrite: false,
    })
    
    const line = new Line(geometry, material)
    line.renderOrder = 2000
    line.frustumCulled = false

    return markRaw(line)
  } catch (e) {
    return null
  }
})

const {
  cameraPosition,
  gridSize,
  gridDivisions,
  gridPosition,
  showGrid,
  updateGridFromModel,
  adjustCamera: adjustCameraController
} = useCameraController()

function onViewpointSelectedFromList(index: number) {
  const vp = viewpoints.value?.[index]
  if (vp) {
    onViewpointSelected(vp, index)
  } else {
    const pt = store.parsedPoints[index]
    if (pt) {
      selectedWaypointIndexForView.value = index
      selectedWaypointForEdit.value = { position: [pt.x, pt.y, pt.z], index }
      showFrustum.value = true
      window.dispatchEvent(new CustomEvent('waypoint-selected', { detail: { index } }))
      if (pathGroup.value) {
        pathGroup.value.traverse((child) => {
          if (child instanceof Mesh && child.userData && child.userData.index === index) {
            highlightWaypoint(child)
          }
        })
      }
    }
  }
}

function onViewpointSelected(v: any, index: number) {
  selectedWaypointIndexForView.value = index
  
  // A. 触发全局事件，通知 KPIPanel 更新右侧数据
  window.dispatchEvent(new CustomEvent('waypoint-selected', { detail: { index: index } }))

  // B. 更新编辑选点状态，显示朝向线、线框、高亮
  if (v && v.position) {
      selectedWaypointForEdit.value = { 
          position: [v.position.x, v.position.y, v.position.z], 
          index: index 
      }
      showFrustum.value = true
  }

  // C. 高亮对应的 3D Mesh
  if (pathGroup.value) {
      pathGroup.value.traverse((child) => {
          if (child instanceof Mesh && child.userData && child.userData.index === index) {
              highlightWaypoint(child)
          }
      })
  }
}

function resetCameraView() {
  adjustCameraController(buildingModel.value, store.parsedPoints, controlsRef, cameraRef)
}

const saveMessage = ref<'saving' | 'saved' | 'error' | null>(null)
const saveErrorMessage = ref('')
async function handleSaveToBackend() {
  if (!authStore.user?.userId || !buildingModel.value || store.parsedPoints.length === 0) return
  saveMessage.value = 'saving'
  saveErrorMessage.value = ''
  try {
    const meshData = extractAllMeshData(buildingModel.value)
    const modelFileName = store.modelFiles[0]?.name || 'model.obj'
    // 模型已保存过则只保存航点，避免重复传输大模型数据
    await saveProjectData(
      authStore.user.userId,
      meshData ? { vertices: meshData.vertices, indices: meshData.indices } : null,
      store.parsedPoints,
      modelFileName,
      modelSavedToBackend.value,
      store.currentProjectId
    )
    modelSavedToBackend.value = true
    saveMessage.value = 'saved'
    setTimeout(() => { saveMessage.value = null }, 2500)
  } catch (err) {
    console.error('Save failed:', err)
    saveMessage.value = 'error'
    saveErrorMessage.value = err instanceof Error ? err.message : String(err)
    setTimeout(() => { saveMessage.value = null; saveErrorMessage.value = '' }, 4000)
  }
}

const raycaster = new Raycaster()
const mouse = new Vector2()
let currentSelectedWaypoint: Mesh | null = null
let currentSelectedWaypointIndex: number | null = null 

function ensureCameraControlsEnabled() {
  nextTick(() => {
    if (controlsRef.value) {
      const controls = controlsRef.value.value || controlsRef.value
      if (controls) {
        controls.enabled = true
        if (controls.enableRotate !== undefined) controls.enableRotate = true
        if (controls.enablePan !== undefined) controls.enablePan = true
        if (controls.enableZoom !== undefined) controls.enableZoom = true
      }
    }
  })
}

function highlightWaypoint(mesh: Mesh) {
  if (!mesh) return

  if (currentSelectedWaypoint && currentSelectedWaypoint !== mesh) {
    clearWaypointHighlight(currentSelectedWaypoint)
  }

  const material = mesh.material as MeshBasicMaterial
  material.color.set(COLOR_CURRENT)
  material.needsUpdate = true
  currentSelectedWaypoint = mesh
  currentSelectedWaypointIndex = mesh.userData.index
}

function clearWaypointHighlight(mesh: Mesh) {
  if (!mesh) return
  const prevIndex = mesh.userData?.index
  const prevMaterial = mesh.material as MeshBasicMaterial
  if (prevMaterial) {
    if (prevIndex === 0) {
      prevMaterial.color.set(0x00ff00)
    } else if (prevIndex === store.parsedPoints.length - 1) {
      prevMaterial.color.set(0xff0000)
    } else {
      prevMaterial.color.set(COLOR_UNSCANNED)
    }
  }
}

/** 起点绿（与扫过绿区分） */
const COLOR_START = 0x00ff00
/** 扫过的航点（墨绿，区别于起点亮绿） */
const COLOR_SCANNED = 0x2d5a27
/** 当前/选中 - 白色（黑白调） */
const COLOR_CURRENT = 0xffffff
/** 未扫描 - 深灰（与建筑物浅灰 0xcfd8dc 区分） */
const COLOR_UNSCANNED = 0x4a4a4a
/** 终点 - 红色 */
const COLOR_END = 0xff0000

function updateWaypointColorsForPlaybackState() {
  if (!pathGroup.value) return
  const total = store.parsedPoints.length
  const pbIdx = store.playbackIndex
  const currentIdx = Math.floor(pbIdx)

  pathGroup.value.traverse((obj: any) => {
    if (!(obj instanceof Mesh) || !obj.userData?.isWaypoint) return
    const idx = obj.userData.index as number
    const mat = obj.material as MeshBasicMaterial
    if (!mat) return

    if (store.isPlaybackMode) {
      if (idx === 0) {
        mat.color.set(COLOR_START)
      } else if (idx === currentIdx) {
        mat.color.set(COLOR_CURRENT)
      } else if (idx < currentIdx) {
        mat.color.set(COLOR_SCANNED)
      } else if (idx === total - 1) {
        mat.color.set(COLOR_END)
      } else {
        mat.color.set(COLOR_UNSCANNED)
      }
    } else {
      const sel = selectedWaypointIndexForView.value
      if (sel === idx) {
        mat.color.set(COLOR_CURRENT)
      } else if (idx === 0) {
        mat.color.set(COLOR_START)
      } else if (idx === total - 1) {
        mat.color.set(COLOR_END)
      } else {
        mat.color.set(COLOR_UNSCANNED)
      }
    }
  })
}

function clearWaypointSelection() {
  if (currentSelectedWaypoint) {
    clearWaypointHighlight(currentSelectedWaypoint)
    currentSelectedWaypoint = null
    currentSelectedWaypointIndex = null
  }
  selectedWaypointForEdit.value = null
  selectedWaypointIndexForView.value = null
  showFrustum.value = false
  window.dispatchEvent(new CustomEvent('waypoint-deselected'))
}

function onInsertPointBefore(index: number) {
  const newIndex = store.insertPointBefore(index)
  if (newIndex === null) return
  selectNewlyInsertedWaypoint(newIndex)
}

function onInsertPointAfter(index: number) {
  const newIndex = store.insertPointAfter(index)
  if (newIndex === null) return
  selectNewlyInsertedWaypoint(newIndex)
}

async function onOptimizePath() {
  const confirmed = await showOptimizeConfirmDialog(
    'Reorders waypoints only (start fixed). Positions unchanged, coverage unchanged. Paths that collide with the building are penalized. Continue?'
  )
  if (!confirmed) return

  const oldIds = store.parsedPoints.map(p => p.id).join(',')
  const meshData = buildingModel.value ? extractAllMeshData(buildingModel.value) : null
  try {
    await store.optimizePath(meshData ?? undefined)
    const newIds = store.parsedPoints.map(p => p.id).join(',')
    if (oldIds === newIds) {
      await showOptimizeConfirmDialog('Path is already optimal.', {
        showCancel: false,
        confirmLabel: 'OK'
      })
    } else {
      // 路径已优化（仅顺序变化），重新计算 KPI（总距离会变短，覆盖率不变）
      playbackCoverageCache.clear()
      await calculateKPIs(true) // show overlay only during path optimization
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await showOptimizeConfirmDialog(msg, {
      showCancel: false,
      confirmLabel: 'OK'
    })
  } finally {
    selectedWaypointForEdit.value = null
    selectedWaypointIndexForView.value = null
    showFrustum.value = false
  }
}

async function onDeletePoint(index: number) {
  const confirmed = await showDeleteConfirmDialog(
    `Are you sure you want to delete Viewpoint ${index + 1}?`
  )
  if (!confirmed) return
  store.deletePoint(index)
  selectedWaypointForEdit.value = null
  selectedWaypointIndexForView.value = null
  showFrustum.value = false
  window.dispatchEvent(new CustomEvent('waypoint-deselected'))
}

function selectNewlyInsertedWaypoint(newIndex: number) {
  const point = store.parsedPoints[newIndex]
  if (!point) return
  selectedWaypointForEdit.value = { position: [point.x, point.y, point.z], index: newIndex }
  selectedWaypointIndexForView.value = newIndex
  showFrustum.value = true
  window.dispatchEvent(new CustomEvent('waypoint-selected', { detail: { index: newIndex } }))
  if (viewpoints.value && viewpoints.value.length > newIndex) {
    const vp = viewpoints.value[newIndex]
    if (vp?.position && vp?.direction) onViewpointSelected(vp, newIndex)
  }
  nextTick(() => {
    if (!pathGroup.value) return
    pathGroup.value.traverse((obj: any) => {
      if (obj.userData?.isWaypoint && obj.userData?.index === newIndex) {
        highlightWaypoint(obj as Mesh)
      }
    })
  })
}

function goHome() {
  store.stopPlayback()
  playbackCoverageCache.clear()
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
  store.resetAll()
  router.replace('/Home')
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsText(file)
  })
}

/** 从 meshData 构建 OBJ 字符串，用 OBJLoader 解析（与首次导入完全相同的加载路径） */
function buildModelFromMeshData(meshData: { vertices: number[]; indices?: number[] }): Object3D {
  const verts = Array.isArray(meshData.vertices) ? meshData.vertices : []
  if (verts.length < 9) {
    console.warn('[buildModelFromMeshData] 顶点数据不足')
    return new Group()
  }
  const lines: string[] = ['# Reconstructed from backend']
  for (let i = 0; i < verts.length; i += 3) {
    const x = typeof verts[i] === 'number' && Number.isFinite(verts[i]) ? verts[i] : 0
    const y = typeof verts[i + 1] === 'number' && Number.isFinite(verts[i + 1]) ? verts[i + 1] : 0
    const z = typeof verts[i + 2] === 'number' && Number.isFinite(verts[i + 2]) ? verts[i + 2] : 0
    lines.push(`v ${x} ${y} ${z}`)
  }
  const idx = meshData.indices && meshData.indices.length >= 3 ? meshData.indices : null
  if (idx) {
    for (let i = 0; i < idx.length; i += 3) {
      const a = (typeof idx[i] === 'number' ? Math.floor(idx[i]) : 0) + 1
      const b = (typeof idx[i + 1] === 'number' ? Math.floor(idx[i + 1]) : 0) + 1
      const c = (typeof idx[i + 2] === 'number' ? Math.floor(idx[i + 2]) : 0) + 1
      lines.push(`f ${a} ${b} ${c}`)
    }
  } else {
    const vCount = Math.floor(verts.length / 3)
    for (let i = 0; i < vCount; i += 3) {
      lines.push(`f ${i + 1} ${i + 2} ${i + 3}`)
    }
  }
  const objText = lines.join('\n')
  const loader = new OBJLoader()
  const model = loader.parse(objText)
  model.traverse((child: any) => {
    if (child.isMesh && child.geometry) {
      if (!child.geometry.attributes.normal) child.geometry.computeVertexNormals()
      child.material = new MeshStandardMaterial({
        color: 0xcfd8dc, metalness: 0.1, roughness: 0.8,
        emissive: 0x111111, emissiveIntensity: 0.15,
        side: DoubleSide, transparent: false, opacity: 1,
        polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1
      })
    } else if (child.isLine) {
      child.visible = false
    }
  })
  return model
}

async function loadObjModel() {
  try {
    const obj = store.modelFiles.find(f => f.name.toLowerCase().endsWith('.obj'))
    if (!obj) return

    const objText = await readFileAsText(obj)
    const blob = new Blob([objText], { type: 'text/plain' })
    const objURL = URL.createObjectURL(blob)

    const loader = new OBJLoader()
    const model: Object3D = await new Promise((resolve, reject) => {
      loader.load(objURL, (group) => resolve(group), undefined, (err) => reject(err))
    })
    URL.revokeObjectURL(objURL)

    const allChildren: any[] = []
    model.traverse((child: any) => allChildren.push(child))

    const chunkSize = 100
    for (let i = 0; i < allChildren.length; i += chunkSize) {
      const chunk = allChildren.slice(i, i + chunkSize)
      chunk.forEach((child: any) => {
        const isMesh = (child as any).isMesh || child.type === 'Mesh' || child instanceof Mesh
        const isLine = (child as any).isLine || child.type === 'Line'

        if (isMesh) {
          if (!child.geometry.attributes.normal) child.geometry.computeVertexNormals()
          child.material = new MeshStandardMaterial({
            color: 0xcfd8dc, metalness: 0.1, roughness: 0.8,
            emissive: 0x111111, emissiveIntensity: 0.15,
            side: DoubleSide, transparent: false, opacity: 1,
            polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1
          })
        } else if (isLine) {
          child.visible = false
        }
      })
      await new Promise(resolve => setTimeout(resolve, 0))
    }
    buildingModel.value = markRaw(model)
  } catch (error) {
    console.error('建筑模型加载失败:', error)
    buildingModel.value = null
  }
}

function disposeGroup(group: Group | null) {
  if (!group) return
  group.traverse((obj: any) => { obj.geometry?.dispose?.(); obj.material?.dispose?.() })
}

function renderPath() {
  if (store.parsedPoints.length === 0) {
    disposeGroup(pathGroup.value)
    pathGroup.value = null
    return
  }
  const points = store.parsedPoints.map((p) => ({
    x: typeof p.x === 'number' && Number.isFinite(p.x) ? p.x : 0,
    y: typeof p.y === 'number' && Number.isFinite(p.y) ? p.y : 0,
    z: typeof p.z === 'number' && Number.isFinite(p.z) ? p.z : 0,
  }))
  disposeGroup(pathGroup.value)
  const group = new Group()

  const sphere = new SphereGeometry(0.8, 16, 16)
  const createMarkerMaterial = (color: number) => new MeshBasicMaterial({
    color, transparent: true, opacity: 0.95, depthTest: true, depthWrite: true,
  })

  const matStart = createMarkerMaterial(0x00ff00)
  const matEnd = createMarkerMaterial(0xff0000)

  if (points.length > 0) {
    const start = new Mesh(sphere, matStart)
    start.position.set(points[0].x, points[0].y, points[0].z)
    start.renderOrder = 1500
    start.userData = { isWaypoint: true, index: 0 }
    start.addEventListener('click', () => {
      if (store.isPlaybackMode) return
      highlightWaypoint(start)
      window.dispatchEvent(new CustomEvent('waypoint-selected', { detail: { index: 0 } }))
      if (viewpoints.value && viewpoints.value.length > 0) {
        showFrustum.value = true
        onViewpointSelected(viewpoints.value[0], 0)
      }
    })
    group.add(start)
  }

  if (points.length > 1) {
    const end = new Mesh(sphere, matEnd)
    end.position.set(points[points.length - 1].x, points[points.length - 1].y, points[points.length - 1].z)
    end.renderOrder = 1500
    end.userData = { isWaypoint: true, index: points.length - 1 }
    end.addEventListener('click', () => {
      if (store.isPlaybackMode) return
      const idx = points.length - 1
      highlightWaypoint(end)
      window.dispatchEvent(new CustomEvent('waypoint-selected', { detail: { index: idx } }))
      if (viewpoints.value && viewpoints.value.length > idx) {
        showFrustum.value = true
        onViewpointSelected(viewpoints.value[idx], idx)
      }
    })
    group.add(end)
  }

  if (points.length > 2) {
    const middlePoints = points.slice(1, -1)
    for (let i = 0; i < middlePoints.length; i++) {
      const p = middlePoints[i]
      const pointIndex = i + 1
      const matMid = createMarkerMaterial(COLOR_UNSCANNED)
      const mid = new Mesh(sphere, matMid)
      mid.position.set(p.x, p.y, p.z)
      mid.renderOrder = 1500
      mid.userData = { isWaypoint: true, index: pointIndex }
      mid.addEventListener('click', () => {
        if (store.isPlaybackMode) return
        highlightWaypoint(mid)
        window.dispatchEvent(new CustomEvent('waypoint-selected', { detail: { index: pointIndex } }))
        if (viewpoints.value && viewpoints.value.length > pointIndex) {
          showFrustum.value = true
          onViewpointSelected(viewpoints.value[pointIndex], pointIndex)
        }
      })
      group.add(mid)
    }
  }

  if (showPathLines.value && points.length >= 2) {
    const rawVerts = points.flatMap((p) => [
      typeof p.x === 'number' && Number.isFinite(p.x) ? p.x : 0,
      typeof p.y === 'number' && Number.isFinite(p.y) ? p.y : 0,
      typeof p.z === 'number' && Number.isFinite(p.z) ? p.z : 0,
    ])
    const lineVerts = new Float32Array(rawVerts)
    if (lineVerts.byteLength > 0) {
      const geom = new BufferGeometry()
      geom.setAttribute('position', new BufferAttribute(lineVerts, 3))
      const lineMaterial = new LineBasicMaterial({
        color: COLOR_UNSCANNED, linewidth: 5, depthTest: true, depthWrite: true,
      })
      const line = new Line(geom, lineMaterial)
      group.add(line)
    }
    
    const segCount = points.length - 1
    if (segCount > 0) {
      const arrowGeometry = new ConeGeometry(0.6, 1.6, 12)
      const arrowMaterial = new MeshBasicMaterial({ 
        color: 0xf47920, depthTest: true, depthWrite: true, transparent: true, opacity: 0.9,
      })
      const arrows = new InstancedMesh(arrowGeometry, arrowMaterial, segCount)
      arrows.renderOrder = 1600
      const m = new Matrix4()
      const up = new Vector3(0, 1, 0)
      for (let i = 0; i < segCount; i++) {
        const p1 = new Vector3(points[i].x, points[i].y, points[i].z)
        const p2 = new Vector3(points[i+1].x, points[i+1].y, points[i+1].z)
        const dir = new Vector3().subVectors(p2, p1)
        const len = dir.length()
        if (len === 0) continue
        dir.normalize()
        const q = new Quaternion().setFromUnitVectors(up, dir)
        const arrowDistance = Math.min(5.0, len * 0.8)
        const pos = new Vector3().copy(p1).addScaledVector(dir, arrowDistance)
        const scale = new Vector3(1.0, Math.max(1.0, Math.min(2.5, len * 0.3)), 1.0)
        m.compose(pos, q, scale)
        arrows.setMatrixAt(i, m)
      }
      arrows.instanceMatrix.needsUpdate = true
      group.add(arrows)
    }
  }

  pathGroup.value = markRaw(group)
  if (!store.isPlaybackMode && currentSelectedWaypointIndex !== null) {
    group.traverse((child) => {
      if ((child as any).isMesh && (child as any).userData?.isWaypoint && (child as any).userData?.index === currentSelectedWaypointIndex) {
        highlightWaypoint(child as Mesh)
      }
    })
  }
  nextTick(() => updateWaypointColorsForPlaybackState())
}

let loadingStartedFlag = false

/** 从后端加载项目（Home 打开时） */
async function loadFromProject(projectId: string) {
  if (loadingStartedFlag) return
  loadingStartedFlag = true
  setLoading(true)
  resetProgress()
  modelDataUploaded.value = false
  modelSavedToBackend.value = true

  try {
    await smoothProgress(10, 100)
    const [meshData, waypoints] = await Promise.all([
      loadModelData(projectId),
      loadWaypoints(projectId),
    ])
    await smoothProgress(40, 150)
    if (!waypoints.length) {
      console.error('Project has no waypoints')
      loadingStartedFlag = false
      return
    }
    store.setCurrentProjectId(projectId)
    store.setParsedPoints(waypoints)
    if (meshData && meshData.vertices.length >= 9) {
      try {
        const model = buildModelFromMeshData(meshData)
        if (model.children.length > 0) {
          buildingModel.value = markRaw(model)
        } else {
          console.warn('Project model data produced empty mesh, showing path only')
          buildingModel.value = null
        }
      } catch (e) {
        console.warn('Failed to build model from backend data:', e)
        buildingModel.value = null
      }
    } else {
      console.warn('Project has no valid model data, showing path only')
      buildingModel.value = null
    }
    await smoothProgress(60, 100)
    await nextTick()
    renderPath()
    await smoothProgress(75, 100)
    if (buildingModel.value) updateGridFromModel(buildingModel.value)
    await nextTick()
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    adjustCameraController(buildingModel.value, store.parsedPoints, controlsRef, cameraRef)
    modelDataUploaded.value = true
    await smoothProgress(85, 100)
    await calculateKPIs()
  } catch (err) {
    console.error('Load project failed:', err)
    saveMessage.value = 'error'
    saveErrorMessage.value = err instanceof Error ? err.message : String(err)
    setTimeout(() => { saveMessage.value = null; saveErrorMessage.value = '' }, 4000)
    router.replace('/Home')
  } finally {
    await smoothProgress(100, 200)
    await new Promise(resolve => setTimeout(resolve, 300))
    setLoading(false)
    showGrid.value = true
    showWelcomeGuide.value = true
  }
}

async function loadAll(){
  modelDataUploaded.value = false
  modelSavedToBackend.value = false
  if (loadingStartedFlag) return

  loadingStartedFlag = true
  setLoading(true)
  resetProgress()

  try {
    if (authStore.user?.userId && !store.currentProjectId) {
      const projId = await getOrCreateProject(authStore.user.userId)
      store.setCurrentProjectId(projId)
    }
    await smoothProgress(5, 150)
    await smoothProgress(10, 150)
    const modelLoadPromise = loadObjModel()
    await smoothProgress(20, 100)
    await modelLoadPromise
    await smoothProgress(40, 200)
    renderPath()
    await smoothProgress(60, 200)
    await smoothProgress(65, 50)
    await nextTick()
    updateGridFromModel(buildingModel.value)
    adjustCameraController(buildingModel.value, store.parsedPoints, controlsRef, cameraRef)
    await smoothProgress(70, 150)
    await smoothProgress(75, 100)
    const kpiPromise = calculateKPIs()
    await smoothProgress(85, 200)
    await smoothProgress(90, 200)
    await kpiPromise
    // Save model and waypoints to backend for logged-in user
    if (authStore.user?.userId && buildingModel.value && store.parsedPoints.length > 0) {
      try {
        const meshData = extractAllMeshData(buildingModel.value)
        const modelFileName = store.modelFiles[0]?.name || 'model.obj'
        await saveProjectData(
          authStore.user.userId,
          meshData ? { vertices: meshData.vertices, indices: meshData.indices } : null,
          store.parsedPoints,
          modelFileName,
          false,
          store.currentProjectId
        )
        modelSavedToBackend.value = true
      } catch (err) {
        console.warn('Failed to save project data to backend:', err)
        saveMessage.value = 'error'
        saveErrorMessage.value = err instanceof Error ? err.message : String(err)
        setTimeout(() => { saveMessage.value = null; saveErrorMessage.value = '' }, 4000)
      }
    }
  } catch (error) {
    console.error('加载过程中出现错误:', error)
  } finally {
    await smoothProgress(100, 300)
    await new Promise(resolve => setTimeout(resolve, 300))
    setLoading(false)
    showGrid.value = true
    showWelcomeGuide.value = true
  }
}

function extractFirstValidMesh(model: any): any {
  if (!model) return null
  if (model.isGroup && model.children && model.children.length > 0) {
    return model.children.find((child: any) => child.geometry && child.geometry.attributes?.position) || null
  }
  return model.geometry && model.geometry.attributes?.position ? model : null
}

/** 预加载/播放时由 BuildingHighlighter 触发，写入缓存供 Playback Metrics 使用 */
/** 播放覆盖率统一由 preloadCoverageFrontend + fetchPlaybackCoverage 提供（与 KPI、单点覆盖率同源算法），不采用 BuildingHighlighter 的独立计算 */
function onPlaybackCoverage(_waypointCount: number, _coverage: number) {
  // 不再用 BuildingHighlighter 的结果覆盖缓存，确保与 Mission Overview 一致
}

/** 播放模式下获取累计覆盖率：播放时使用前端计算（与 KPI 同源算法），减少频繁调用接口 */
const playbackCoverageCache = new Map<number, number>()
async function fetchPlaybackCoverage(waypointCount: number): Promise<number | null> {
  if (waypointCount <= 0 || !buildingModel.value || store.parsedPoints.length === 0) return 0
  const cached = playbackCoverageCache.get(waypointCount)
  if (cached !== undefined) return cached

  const subset = store.parsedPoints.slice(0, waypointCount)
  if (subset.length < 2) return 0

  const pathPoints: Array<{ x: number; y: number; z: number; normal?: { x: number; y: number; z: number } }> =
    subset.map((point) => {
      let normal: { x: number; y: number; z: number } | undefined
      if (point.normal) {
        const n = point.normal
        const len = Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z)
        if (len > 0.001) normal = { x: n.x / len, y: n.y / len, z: n.z / len }
      }
      return { x: point.x, y: point.y, z: point.z, normal }
    })

  // 使用前端计算（与 BuildingHighlighter、后端 CoverageCalculatorService 同源算法），避免频繁请求接口
  const cov = calculatePathCoverageFrontend(pathPoints, buildingModel.value)
  if (cov != null) playbackCoverageCache.set(waypointCount, cov)
  return cov
}

async function calculateKPIs(showOverlay = false) {
  try {
    if (showOverlay) kpiStore.startCalculation()
    await new Promise(resolve => setTimeout(() => resolve(undefined), 10))

    const pathPoints = store.parsedPoints.map((point) => {
      let normal = { x: 0, y: -1, z: 0 }
      if (point.normal) {
        const n = point.normal
        const len = Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z)
        if (len > 0.001) normal = { x: n.x / len, y: n.y / len, z: n.z / len }
      }
      return {
        x: point.x,
        y: point.y,
        z: point.z,
        normalX: normal.x, normalY: normal.y, normalZ: normal.z
      }
    })

    if (pathPoints.length < 2) return

    let buildingMesh = null
    if (!modelDataUploaded.value && buildingModel.value) {
      await new Promise(resolve => setTimeout(() => resolve(undefined), 20))
      const meshData = extractAllMeshData(buildingModel.value)
      if (meshData) {
        buildingMesh = {
          vertices: meshData.vertices,
          indices: meshData.indices && meshData.indices.length > 0 ? meshData.indices : undefined
        }
        modelDataUploaded.value = true
      }
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), BACKEND_CONFIG.TIMEOUT)

    const projId = store.currentProjectId || BACKEND_CONFIG.DEFAULT_PROJECT_ID
    const response = await fetch(`${BACKEND_CONFIG.BASE_URL}/api/projects/${projId}/kpi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pathPoints, buildingMesh }),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) throw new Error(`KPI calculation failed (${response.status})`)
    const kpiMetrics = await response.json()
    kpiStore.setKpiMetrics(kpiMetrics)
  } catch (error) {
    console.error('KPI calculation failed:', error)
    kpiStore.setError(error instanceof Error ? error.message : 'Calculation failed')
  }
}

onMounted(() => {
  store.stopPlayback()
  const projectId = route.query.projectId
  if (typeof projectId === 'string' && projectId) {
    loadFromProject(projectId)
  } else {
    loadAll()
  }
  ensureCameraControlsEnabled()
})

watch(controlsRef, (newControls) => {
  if (newControls) nextTick(() => ensureCameraControlsEnabled())
}, { immediate: true })

watch(() => store.isPlaybackMode, () => {
  nextTick(() => {
    if (!controlsRef.value) return
    const controls = controlsRef.value.value || controlsRef.value
    if (controls) controls.enabled = store.isPlaybackMode || !highlightLoading.value
  })
})

watch(highlightLoading, (loading) => {
  nextTick(() => {
    if (!controlsRef.value) return
    const controls = controlsRef.value.value || controlsRef.value
    if (controls) controls.enabled = store.isPlaybackMode || !loading
  })
})

watch(() => store.parsedPoints, () => {
  playbackCoverageCache.clear()
  if (store.parsedPoints.length > 0) {
    renderPath()
    if (selectedWaypointForEdit.value) {
      const point = store.parsedPoints[selectedWaypointForEdit.value.index]
      if (point) selectedWaypointForEdit.value.position = [point.x, point.y, point.z]
    }
  }
}, { deep: true })

watch(showPathLines, (newValue) => renderPath())

watch(
  () => [store.isPlaybackMode, Math.floor(store.playbackIndex), selectedWaypointIndexForView.value],
  () => updateWaypointColorsForPlaybackState(),
  { immediate: true }
)

function handleCanvasClick(event: MouseEvent) {
  if (!cameraRef.value || !pathGroup.value) return
  const rect = (event.currentTarget as HTMLElement)?.getBoundingClientRect()
  if (!rect) return
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(mouse, cameraRef.value)
  const intersects = raycaster.intersectObjects([...(buildingModel.value ? [buildingModel.value] : []), ...pathGroup.value.children], true)
  if (intersects.length > 0) {
    // 保留原有点击逻辑
  }
}

function handleMouseDown(event: MouseEvent) {
  if (store.isPlaybackMode || !cameraRef.value || !pathGroup.value) return
  const rect = (event.currentTarget as HTMLElement)?.getBoundingClientRect()
  if (!rect) return
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(mouse, cameraRef.value)
  
  const allIntersects: any[] = []
  if (buildingModel.value) allIntersects.push(...raycaster.intersectObject(buildingModel.value, true))
  allIntersects.push(...raycaster.intersectObjects(pathGroup.value.children, true))
  allIntersects.sort((a, b) => a.distance - b.distance)
  
  if (allIntersects.length > 0) {
    const closest = allIntersects[0]
    if (closest.object.userData?.isWaypoint) {
      const blocked = allIntersects.some(i => i.distance < closest.distance && !i.object.userData?.isWaypoint)
      if (!blocked) {
        const idx = closest.object.userData.index
        const pt = store.parsedPoints[idx]
        if (pt) {
          selectedWaypointForEdit.value = { position: [pt.x, pt.y, pt.z], index: idx }
          highlightWaypoint(closest.object as Mesh)
          window.dispatchEvent(new CustomEvent('waypoint-selected', { detail: { index: idx } }))
          if (viewpoints.value && viewpoints.value.length > idx) {
            showFrustum.value = true
            selectedWaypointIndexForView.value = idx
            onViewpointSelected(viewpoints.value[idx], idx)
          }
        }
        event.preventDefault(); event.stopPropagation()
      } else {
        event.preventDefault(); event.stopPropagation()
      }
    }
  }
}

function handleMouseUp(_event: MouseEvent) {}
function handleMouseLeave(_event: MouseEvent) {}

function onLoop(){
  if (cameraRef.value && controlsRef.value) {
    window.dispatchEvent(new CustomEvent('camera-update', {
      detail: { quaternion: cameraRef.value.quaternion.clone() }
    }))
  }
}

defineExpose({ recalculateKpi: calculateKPIs })
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

.kpi-panel-container {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 1001;
}

.playback-timeline-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 420px;
  z-index: 1000;
}

/* 保存状态全屏遮罩 - 与 DroneLoading 预加载风格一致 */
.save-status-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: rgba(0, 0, 0, 0.75);
  color: var(--text-primary);
  z-index: 9998;
  animation: saveOverlayIn 0.25s ease-out;
}

.save-status-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
}

.save-status-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: var(--font-weight-bold);
  line-height: 1;
}
.save-status-icon.saved {
  background: rgba(81, 207, 102, 0.2);
  border: 2px solid rgba(81, 207, 102, 0.6);
  color: rgba(81, 207, 102, 1);
}
.save-status-icon.error {
  background: rgba(255, 71, 87, 0.2);
  border: 2px solid rgba(255, 71, 87, 0.6);
  color: var(--accent-red);
}

.save-status-text {
  font-size: 13px;
  font-weight: var(--font-weight-medium);
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.85);
  margin: 0;
}

.save-error-detail {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  margin: 0;
  max-width: 360px;
  text-align: center;
  line-height: 1.5;
}

@keyframes saveOverlayIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

</style>