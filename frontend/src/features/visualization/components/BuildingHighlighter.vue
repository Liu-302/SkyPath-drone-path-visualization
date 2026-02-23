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
import {
  buildPyramidFromCamera,
  calculateCameraOrientationFromNormal,
  computeDynamicHToMesh,
  getVisibleMeshFacesByPyramid,
  vfovToHfov,
  type Pyramid,
} from '@/shared/utils/camera-utils'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Mesh,
  NormalBlending,
  Points,
  PointsMaterial,
  ShaderMaterial,
  Vector3,
  Vector4,
} from 'three'
import type { Blending } from 'three'
import { CAMERA_CONFIG, COVERAGE_CONFIG } from '@/shared/constants/constants'
import BackendHighlightService from '@/shared/services/backendHighlightService'
import { fetchPlaybackHighlight } from '@/shared/services/backendPlaybackHighlightService'
import type { PlaybackHighlightResult } from '@/shared/services/backendPlaybackHighlightService'
import { extractAllMeshData, computeCoverageFromFaceIndices } from '@/shared/utils/mesh-utils'

interface Props {
  cameraView: CameraView | null
  /** 全部视点（用于显示整体覆盖率，高亮所有被扫描到的面） */
  allViewpoints?: CameraView[] | null
  /** 播放模式：已飞过的视点（0 到 currentIndex-1），绿色高亮 */
  playbackPastViewpoints?: CameraView[] | null
  /** 播放模式：当前视点，橙色高亮 */
  playbackCurrentViewpoint?: CameraView | null
  /** 预取：接近下一航点时提前请求的数据 */
  prefetchPastViewpoints?: CameraView[] | null
  prefetchCurrentViewpoint?: CameraView | null
  /** 播放是否暂停：未暂停时跳过重计算以保流畅 */
  playbackPaused?: boolean
  /** 播放前预加载：为 true 时按 preloadViewpoints 预取所有航点高亮，减少播放时卡顿 */
  preloadRequested?: boolean
  /** 预加载用的全部视点（与 path 对应） */
  preloadViewpoints?: CameraView[] | null
  buildingMesh: any | null
  visible: boolean
  debugMarkers?: boolean
  fallbackCount?: number
}

const props = withDefaults(defineProps<Props>(), {
  cameraView: null,
  allViewpoints: null,
  playbackPastViewpoints: null,
  playbackCurrentViewpoint: null,
  prefetchPastViewpoints: null,
  prefetchCurrentViewpoint: null,
  playbackPaused: true,
  preloadRequested: false,
  preloadViewpoints: null,
  buildingMesh: null,
  visible: false,
  debugMarkers: false,
  fallbackCount: 0,
})

const emit = defineEmits<{
  'highlight-loading': [loading: boolean]
  /** [View] 全视点高亮加载进度 (loaded, total) */
  'highlight-loading-progress': [loaded: number, total: number]
  /** 从高亮面索引直接计算的覆盖率，无需额外请求 */
  'playback-coverage': [waypointCount: number, coverage: number]
  /** 播放前预加载进度 */
  'preload-progress': [loaded: number, total: number]
  /** 播放前预加载完成 */
  'preload-complete': []
}>()

// highlight mesh instances we create per source mesh
const highlightMeshes = ref<Array<Mesh>>([])
/** 叠加层（选中点的黄色高亮），可单独移除而不影响全局绿色 */
const overlayHighlightMeshes = ref<Array<Mesh>>([])
const markerEntities = ref<Array<Points>>([])
// 全视点模式异步计算时用于取消过期的任务
let allCoverageRunId = 0
/** 用于检测「仅选中变化」：上次全量计算时的 allViewpoints 和 buildingMesh */
let lastAllViewpointsRef: typeof props.allViewpoints = null
let lastBuildingMeshRef: any = null

/** 单视点高亮颜色（选中某个航点时），与播放当前视点一致 */
const SINGLE_VIEWPOINT_HIGHLIGHT_COLOR = 0xffa500 // 橙色
/** 全局覆盖高亮颜色（点击 [View] 显示全部覆盖时） */
const ALL_COVERAGE_HIGHLIGHT_COLOR = 0x4caf50 // 绿色
/** 播放模式：之前扫过的区域 */
const PLAYBACK_PAST_HIGHLIGHT_COLOR = 0x4caf50 // 绿色
/** 播放模式：此时此刻的当前视点 */
const PLAYBACK_CURRENT_HIGHLIGHT_COLOR = 0xffa500 // 橙色

/** 是否使用后端模式 - 已禁用，因为后端端点已被删除 */
const useBackend = ref(false)

type ClipPlane = Vector4 // (nx, ny, nz, d) where dot(n, p) + d >= 0 means inside

function planeFromPoints(a: Vector3, b: Vector3, c: Vector3): ClipPlane {
  const ab = new Vector3().subVectors(b, a)
  const ac = new Vector3().subVectors(c, a)
  const n = new Vector3().crossVectors(ab, ac)
  const len = n.length()
  if (len < 1e-12) {
    // degenerate; return a harmless plane that always passes
    return new Vector4(0, 0, 0, 0)
  }
  n.multiplyScalar(1 / len)
  const d = -n.dot(a)
  return new Vector4(n.x, n.y, n.z, d)
}

function ensurePlaneFacesInside(plane: ClipPlane, insidePoint: Vector3): ClipPlane {
  const dist = plane.x * insidePoint.x + plane.y * insidePoint.y + plane.z * insidePoint.z + plane.w
  if (dist >= 0) return plane
  return new Vector4(-plane.x, -plane.y, -plane.z, -plane.w)
}

function buildPyramidClipPlanes(pyramid: Pyramid): ClipPlane[] {
  const v = pyramid.apex
  const [b1, b2, b3, b4] = pyramid.base
  const baseCenter = new Vector3().addVectors(b1, b2).add(b3).add(b4).multiplyScalar(0.25)
  const insidePoint = v.clone().lerp(baseCenter, 0.5)

  // 4 side planes: each through apex + two adjacent base corners
  const side = [
    planeFromPoints(v, b1, b2),
    planeFromPoints(v, b2, b3),
    planeFromPoints(v, b3, b4),
    planeFromPoints(v, b4, b1),
  ].map(p => ensurePlaneFacesInside(p, insidePoint))

  // base plane: through three base corners
  const base = ensurePlaneFacesInside(planeFromPoints(b1, b2, b3), insidePoint)

  // near plane: exclude anything "behind" the apex (otherwise side+base halfspaces form an infinite pyramid)
  const forward = new Vector3().subVectors(baseCenter, v)
  if (forward.lengthSq() < 1e-12) {
    // fallback: if degenerate, skip near plane by using a pass-through plane
    const nearPass = new Vector4(0, 0, 0, 0)
    return [...side, base, nearPass]
  }
  forward.normalize()
  const nearPoint = v.clone().addScaledVector(forward, 1e-4) // tiny offset to avoid precision issues
  const near = ensurePlaneFacesInside(new Vector4(forward.x, forward.y, forward.z, -forward.dot(nearPoint)), insidePoint)

  return [...side, base, near]
}

function createClippedHighlightMaterial(planes: ClipPlane[], colorHex = 0xffa500, blending: Blending = AdditiveBlending): ShaderMaterial {
  const uPlanes = planes.slice(0, 6)
  while (uPlanes.length < 6) uPlanes.push(new Vector4(0, 0, 0, 0))

  const color = new Color(colorHex)

  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
    side: DoubleSide,
    uniforms: {
      uPlanes: { value: uPlanes },
      uColor: { value: new Vector3(color.r, color.g, color.b) },
      uOpacity: { value: 0.6 },
      uCameraPosition: { value: new Vector3(0, 0, 0) },
      uReferenceDistance: { value: 100 },
      uBaseOffset: { value: 0.025 },
    },
    vertexShader: `
      uniform vec3 uCameraPosition;
      uniform float uReferenceDistance;
      uniform float uBaseOffset;
      varying vec3 vWorldPos;
      void main() {
        vec4 worldPos4 = modelMatrix * vec4(position, 1.0);
        float dist = length(worldPos4.xyz - uCameraPosition);
        float offset = max(uBaseOffset * (dist / uReferenceDistance), 0.001);
        vec3 offsetPos = position + normal * offset;
        vec4 worldPos = modelMatrix * vec4(offsetPos, 1.0);
        vWorldPos = worldPos.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(offsetPos, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec4 uPlanes[6];
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec3 vWorldPos;
      void main() {
        // inside-test with a tiny epsilon to reduce edge flicker
        for (int i = 0; i < 6; i++) {
          vec4 pl = uPlanes[i];
          float dist = dot(pl.xyz, vWorldPos) + pl.w;
          // more tolerant epsilon to avoid "shrinking" near edges
          if (dist < -1e-3) discard;
        }
        gl_FragColor = vec4(uColor, uOpacity);
      }
    `,
  })
}

function disposeHighlight() {
  const toDispose = [...highlightMeshes.value, ...overlayHighlightMeshes.value]
  if (!toDispose.length && !markerEntities.value.length) return
  try {
    for (const hm of toDispose) {
      const g = hm.geometry as BufferGeometry
      const m = hm.material as any
      hm.parent?.remove(hm)
      g?.dispose()
      if (m) {
        if (Array.isArray(m)) m.forEach((x: any) => x.dispose && x.dispose())
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
  overlayHighlightMeshes.value = []
  markerEntities.value = []
}

/** 仅移除叠加层（黄色），保留全局绿色高亮 */
function disposeOverlayOnly() {
  for (const hm of overlayHighlightMeshes.value) {
    const g = hm.geometry as BufferGeometry
    const m = hm.material as any
    hm.parent?.remove(hm)
    g?.dispose()
    if (m) {
      if (Array.isArray(m)) m.forEach((x: any) => x.dispose && x.dispose())
      else m.dispose && m.dispose()
    }
  }
  overlayHighlightMeshes.value = []
}

function buildHighlightMeshFromFaces(mesh: any, faceIndices: number[], clipPlanes: ClipPlane[], colorHex: number, blending: Blending = AdditiveBlending): Mesh | null {
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

  const mat = createClippedHighlightMaterial(clipPlanes, colorHex, blending)

  const hm = new Mesh(highlightGeom, mat)
  hm.renderOrder = 1 // 在建筑模型（renderOrder=0）之后渲染，确保透明高亮正确显示
  hm.frustumCulled = false
  hm.onBeforeRender = (_renderer, _scene, camera) => {
    const uniforms = (hm.material as ShaderMaterial).uniforms
    if (uniforms?.uCameraPosition) uniforms.uCameraPosition.value.copy(camera.position)
  }
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

/** 与 extractAllMeshData 保持相同顺序：仅包含有 geometry 和 position 的 mesh */
function getMeshesToProcess(mesh: any): any[] {
  const result: any[] = []
  if (mesh.isGroup || mesh.type === 'Group') {
    mesh.traverse((child: any) => {
      if ((child.isMesh || child.type === 'Mesh') && child.geometry?.attributes?.position) result.push(child)
    })
  } else if (mesh.isMesh || mesh.type === 'Mesh') {
    if (mesh.geometry?.attributes?.position) result.push(mesh)
  }
  return result
}

/** 预取缓存：waypointIndex -> 后端结果，到达航点时优先使用 */
const playbackHighlightCache = new Map<number, PlaybackHighlightResult>()
let playbackHighlightInFlight = 0
/** 前端增量缓存：上一航点的 pastByMesh+currentByMesh，避免每帧重算全部视点 O(N) */
const frontendIncrementalCache = new Map<number, { pastByMesh: Map<number, number[]>; currentByMesh: Map<number, number[]> }>()

function getMeshFaceOffsets(meshes: any[]): number[] {
  const offsets: number[] = [0]
  for (const m of meshes) {
    const geom = m.geometry
    if (!geom) continue
    const pos = geom.attributes?.position
    const idx = geom.index
    const faceCount = idx ? idx.count / 3 : (pos ? pos.count / 3 : 0)
    offsets.push(offsets[offsets.length - 1] + faceCount)
  }
  return offsets
}

function splitGlobalFacesToPerMesh(globalIndices: number[], meshFaceOffsets: number[]): Map<number, number[]> {
  const perMesh = new Map<number, number[]>()
  for (const g of globalIndices) {
    let meshIdx = 0
    for (let i = 0; i < meshFaceOffsets.length - 1; i++) {
      if (g >= meshFaceOffsets[i] && g < meshFaceOffsets[i + 1]) {
        meshIdx = i
        break
      }
      if (i === meshFaceOffsets.length - 2) meshIdx = meshFaceOffsets.length - 2
    }
    const local = g - meshFaceOffsets[meshIdx]
    if (!perMesh.has(meshIdx)) perMesh.set(meshIdx, [])
    perMesh.get(meshIdx)!.push(local)
  }
  return perMesh
}

/** 前端即时计算：增量复用上一航点结果，仅算当前视点，避免 O(N) 重算导致越播越卡 */
function computePlaybackHighlightFrontend(
  pastViewpoints: CameraView[],
  currentViewpoint: CameraView | null,
  meshesToProcess: any[],
  newMesh: any,
): { pastByMesh: Map<number, number[]>; currentByMesh: Map<number, number[]> } {
  const cacheKey = pastViewpoints.length
  const prevCache = cacheKey > 0 ? frontendIncrementalCache.get(cacheKey - 1) : null

  const pastByMesh = new Map<number, number[]>()
  const currentByMesh = new Map<number, number[]>()
  const allViewpoints = [...pastViewpoints]
  if (currentViewpoint) allViewpoints.push(currentViewpoint)

  for (let meshIdx = 0; meshIdx < meshesToProcess.length; meshIdx++) {
    const srcMesh = meshesToProcess[meshIdx]
    if (typeof srcMesh.updateWorldMatrix === 'function') srcMesh.updateWorldMatrix(true, false)

    let pastSet: Set<number>
    let currentSet: Set<number>

    if (prevCache) {
      const prevPast = prevCache.pastByMesh.get(meshIdx) || []
      const prevCurrent = prevCache.currentByMesh.get(meshIdx) || []
      pastSet = new Set([...prevPast, ...prevCurrent])
      currentSet = new Set<number>()
    } else {
      pastSet = new Set<number>()
      currentSet = new Set<number>()
    }

    if (prevCache && currentViewpoint) {
      const v = currentViewpoint
      const dir = v.direction || { x: 0, y: -1, z: 0 }
      const vfovDeg = COVERAGE_CONFIG.vfov
      const hfovDeg = vfovToHfov(vfovDeg, COVERAGE_CONFIG.aspect)
      const h = computeDynamicHToMesh(v.position, dir, newMesh, COVERAGE_CONFIG.fallbackH)
      const pyramid = buildPyramidFromCamera(v.position, dir, vfovDeg, hfovDeg, h)
      const faces = getVisibleMeshFacesByPyramid(pyramid, srcMesh, v.position, { requireFacing: true })
      faces.forEach((f) => {
        pastSet.add(f)
        currentSet.add(f)
      })
    } else if (!prevCache && allViewpoints.length > 0) {
      for (let i = 0; i < allViewpoints.length; i++) {
        const v = allViewpoints[i]
        const dir = v.direction || { x: 0, y: -1, z: 0 }
        const vfovDeg = COVERAGE_CONFIG.vfov
        const hfovDeg = vfovToHfov(vfovDeg, COVERAGE_CONFIG.aspect)
        const h = computeDynamicHToMesh(v.position, dir, newMesh, COVERAGE_CONFIG.fallbackH)
        const pyramid = buildPyramidFromCamera(v.position, dir, vfovDeg, hfovDeg, h)
        const faces = getVisibleMeshFacesByPyramid(pyramid, srcMesh, v.position, { requireFacing: true })
        faces.forEach((f) => pastSet.add(f))
        if (i === allViewpoints.length - 1 && currentViewpoint) {
          currentSet = new Set(faces)
        }
      }
    }

    pastByMesh.set(meshIdx, Array.from(pastSet))
    currentByMesh.set(meshIdx, Array.from(currentSet))
  }

  frontendIncrementalCache.set(cacheKey, {
    pastByMesh: new Map(pastByMesh),
    currentByMesh: new Map(currentByMesh),
  })
  return { pastByMesh, currentByMesh }
}

/** 将 per-mesh 本地面索引转为全局索引，用于覆盖率计算 */
function perMeshToGlobalFaceIndices(byMesh: Map<number, number[]>, meshFaceOffsets: number[]): number[] {
  const global: number[] = []
  for (let i = 0; i < meshFaceOffsets.length - 1; i++) {
    const offset = meshFaceOffsets[i]
    const local = byMesh.get(i) || []
    for (const f of local) global.push(offset + f)
  }
  return global
}

/** 应用高亮：根据 pastByMesh/currentByMesh 渲染绿色+橙色 */
function applyPlaybackHighlight(
  meshesToProcess: any[],
  pastByMesh: Map<number, number[]>,
  currentByMesh: Map<number, number[]>,
  runId: number,
) {
  disposeHighlight()
  for (let i = 0; i < meshesToProcess.length; i++) {
    const srcMesh = meshesToProcess[i]
    const pastLocal = pastByMesh.get(i) || []
    const currentLocal = currentByMesh.get(i) || []
    const currentSet = new Set(currentLocal)
    const pastOnlyFaces = pastLocal.filter((f) => !currentSet.has(f))

    if (pastOnlyFaces.length > 0) {
      const hmGreen = buildHighlightMeshFromFaces(srcMesh, pastOnlyFaces, PASS_THROUGH_PLANES, PLAYBACK_PAST_HIGHLIGHT_COLOR)
      if (hmGreen && runId === allCoverageRunId) {
        hmGreen.renderOrder = 1
        srcMesh.add(hmGreen)
        highlightMeshes.value.push(hmGreen)
      }
    }
    if (currentLocal.length > 0) {
      const hmOrange = buildHighlightMeshFromFaces(srcMesh, currentLocal, PASS_THROUGH_PLANES, PLAYBACK_CURRENT_HIGHLIGHT_COLOR, NormalBlending)
      if (hmOrange && runId === allCoverageRunId) {
        hmOrange.renderOrder = 2
        srcMesh.add(hmOrange)
        overlayHighlightMeshes.value.push(hmOrange)
      }
    }
  }
}

/** 播放模式高亮：暂停时完整计算；播放中仅用缓存，无缓存则跳过重计算保流畅 */
async function runPlaybackHighlight(
  pastViewpoints: CameraView[],
  currentViewpoint: CameraView | null,
  newMesh: any,
  meshesToProcess: any[],
  playbackPaused: boolean,
) {
  lastAllViewpointsRef = null
  lastBuildingMeshRef = null

  if (meshesToProcess.length === 0) {
    disposeHighlight()
    emit('highlight-loading', false)
    return
  }

  allCoverageRunId += 1
  const runId = allCoverageRunId
  emit('highlight-loading', false)

  const meshFaceOffsets = getMeshFaceOffsets(meshesToProcess)
  const meshData = extractAllMeshData(newMesh)
  const cacheKey = pastViewpoints.length

  if (!meshData || meshData.vertices.length === 0) return

  const backendResult = playbackHighlightCache.get(cacheKey) ?? null
  const hasCache = !!backendResult

  const doApply = (pastByMesh: Map<number, number[]>, currentByMesh: Map<number, number[]>) => {
    requestAnimationFrame(() => {
      if (runId !== allCoverageRunId) return
      applyPlaybackHighlight(meshesToProcess, pastByMesh, currentByMesh, runId)
      emit('highlight-loading', false)
    })
  }

  if (hasCache) {
    const coveredFaces = [...new Set([...backendResult!.pastFaceIndices, ...backendResult!.currentFaceIndices])]
    let coverage = computeCoverageFromFaceIndices(meshData, coveredFaces)
    coverage = Number.isFinite(coverage) ? Math.max(0, Math.min(100, coverage)) : 0
    emit('playback-coverage', pastViewpoints.length + 1, coverage)
    const pastByMesh = splitGlobalFacesToPerMesh(backendResult!.pastFaceIndices, meshFaceOffsets)
    const currentByMesh = splitGlobalFacesToPerMesh(backendResult!.currentFaceIndices, meshFaceOffsets)
    doApply(pastByMesh, currentByMesh)
    return
  }

  if (!playbackPaused) {
    /* 播放中且无缓存：跳过重计算，仅发后端，保流畅；后端返回后再显示 */
    playbackHighlightInFlight++
    fetchPlaybackHighlight(
        pastViewpoints.map((v) => ({ position: v.position, direction: v.direction, normal: (v as any).normal })),
        currentViewpoint ? { position: currentViewpoint.position, direction: currentViewpoint.direction, normal: (currentViewpoint as any).normal } : null,
        meshData,
        undefined,
    ).then((result) => {
      playbackHighlightInFlight--
      if (!result) return
      playbackHighlightCache.set(cacheKey, result)
      const cov = [...new Set([...result.pastFaceIndices, ...result.currentFaceIndices])]
      let c = computeCoverageFromFaceIndices(meshData!, cov)
      c = Number.isFinite(c) ? Math.max(0, Math.min(100, c)) : 0
      emit('playback-coverage', pastViewpoints.length + 1, c)
      if (runId !== allCoverageRunId) return
      doApply(splitGlobalFacesToPerMesh(result.pastFaceIndices, meshFaceOffsets), splitGlobalFacesToPerMesh(result.currentFaceIndices, meshFaceOffsets))
    })
    return
  }

  /* 暂停时：用 rAF 做前端计算并显示 */
  requestAnimationFrame(() => {
    if (runId !== allCoverageRunId) return
    const { pastByMesh: frontendPast, currentByMesh: frontendCurrent } = computePlaybackHighlightFrontend(
      pastViewpoints,
      currentViewpoint,
      meshesToProcess,
      newMesh,
    )
    const coveredGlobal = perMeshToGlobalFaceIndices(frontendPast, meshFaceOffsets)
    let frontendCoverage = computeCoverageFromFaceIndices(meshData, coveredGlobal)
    frontendCoverage = Number.isFinite(frontendCoverage) ? Math.max(0, Math.min(100, frontendCoverage)) : 0
    emit('playback-coverage', pastViewpoints.length + 1, frontendCoverage)
    if (runId !== allCoverageRunId) return
    applyPlaybackHighlight(meshesToProcess, frontendPast, frontendCurrent, runId)
    emit('highlight-loading', false)
  })

  playbackHighlightInFlight++
  fetchPlaybackHighlight(
      pastViewpoints.map((v) => ({ position: v.position, direction: v.direction, normal: (v as any).normal })),
      currentViewpoint ? { position: currentViewpoint.position, direction: currentViewpoint.direction, normal: (currentViewpoint as any).normal } : null,
      meshData,
      undefined,
    ).then((result) => {
      playbackHighlightInFlight--
      if (!result) return
      playbackHighlightCache.set(cacheKey, result)
      const cov = [...new Set([...result.pastFaceIndices, ...result.currentFaceIndices])]
      let c = computeCoverageFromFaceIndices(meshData!, cov)
      c = Number.isFinite(c) ? Math.max(0, Math.min(100, c)) : 0
      emit('playback-coverage', pastViewpoints.length + 1, c)
      if (runId !== allCoverageRunId) return
      doApply(splitGlobalFacesToPerMesh(result.pastFaceIndices, meshFaceOffsets), splitGlobalFacesToPerMesh(result.currentFaceIndices, meshFaceOffsets))
  })
}

// 全视点覆盖模式：无裁剪（用 pass-through 平面）
const PASS_THROUGH_PLANES: ClipPlane[] = [
  new Vector4(0, 0, 0, 0),
  new Vector4(0, 0, 0, 0),
  new Vector4(0, 0, 0, 0),
  new Vector4(0, 0, 0, 0),
  new Vector4(0, 0, 0, 0),
  new Vector4(0, 0, 0, 0),
]

/** 播放前预加载：用前端计算（无网络），秒级完成，避免后端 10 分钟 */
watch(
  () => [props.preloadRequested, props.preloadViewpoints, props.buildingMesh] as const,
  ([requested, viewpoints, mesh]) => {
    if (!requested || !viewpoints || viewpoints.length === 0 || !mesh) return
    const meshes = getMeshesToProcess(mesh)
    if (meshes.length === 0) return

    frontendIncrementalCache.clear()
    const meshFaceOffsets = getMeshFaceOffsets(meshes)
    const total = viewpoints.length

    const meshData = extractAllMeshData(mesh)
    const runBatch = (start: number) => {
      requestAnimationFrame(() => {
        const batchSize = 8
        for (let idx = start; idx < Math.min(start + batchSize, total); idx++) {
          if (playbackHighlightCache.has(idx)) continue
          const past = viewpoints.slice(0, idx)
          const current = viewpoints[idx] ?? null
          const { pastByMesh, currentByMesh } = computePlaybackHighlightFrontend(past, current, meshes, mesh)
          const pastOnlyByMesh = new Map<number, number[]>()
          const coveredByMesh = new Map<number, number[]>()
          for (let i = 0; i < meshes.length; i++) {
            const pastLocal = pastByMesh.get(i) || []
            const currLocal = currentByMesh.get(i) || []
            const currSet = new Set(currLocal)
            pastOnlyByMesh.set(i, pastLocal.filter((f) => !currSet.has(f)))
            coveredByMesh.set(i, [...new Set([...pastLocal, ...currLocal])])
          }
          const pastFaceIndices = perMeshToGlobalFaceIndices(pastOnlyByMesh, meshFaceOffsets)
          const currentFaceIndices = perMeshToGlobalFaceIndices(currentByMesh, meshFaceOffsets)
          playbackHighlightCache.set(idx, { pastFaceIndices, currentFaceIndices })
          if (meshData && meshData.vertices.length >= 9) {
            const coveredGlobal = perMeshToGlobalFaceIndices(coveredByMesh, meshFaceOffsets)
            let cov = computeCoverageFromFaceIndices(meshData, coveredGlobal)
            cov = Number.isFinite(cov) ? Math.max(0, Math.min(100, cov)) : 0
            emit('playback-coverage', idx + 1, cov)
          }
          emit('preload-progress', idx + 1, total)
        }
        const nextStart = start + batchSize
        if (nextStart < total) {
          runBatch(nextStart)
        } else {
          emit('preload-complete')
        }
      })
    }
    runBatch(0)
  },
  { immediate: true },
)

/** 预取：接近下一航点时提前请求，到达时可直接用缓存 */
watch(
  () => [props.prefetchPastViewpoints, props.prefetchCurrentViewpoint, props.buildingMesh] as const,
  async ([prefetchPast, prefetchCurrent, mesh]) => {
    if (!prefetchPast || !prefetchCurrent || !mesh) return
    const meshes = getMeshesToProcess(mesh)
    if (meshes.length === 0) return
    const meshData = extractAllMeshData(mesh)
    if (!meshData || meshData.vertices.length === 0) return
    const cacheKey = prefetchPast.length
    if (playbackHighlightCache.has(cacheKey)) return
    try {
      const result = await fetchPlaybackHighlight(
        prefetchPast.map((v) => ({ position: v.position, direction: v.direction, normal: (v as any).normal })),
        { position: prefetchCurrent.position, direction: prefetchCurrent.direction, normal: (prefetchCurrent as any).normal },
        meshData,
      )
      if (result) playbackHighlightCache.set(cacheKey, result)
    } catch {
      // 预取失败忽略
    }
  },
  { immediate: true },
)

watch(
  [
    () => props.cameraView,
    () => props.allViewpoints,
    () => props.playbackPastViewpoints,
    () => props.playbackCurrentViewpoint,
    () => props.playbackPaused,
    () => props.buildingMesh,
    () => props.visible,
  ],
  async ([newView, newAllViews, playbackPast, playbackCurrent, playbackPaused, newMesh, newVisible]: [
    CameraView | null,
    CameraView[] | null | undefined,
    CameraView[] | null | undefined,
    CameraView | null | undefined,
    boolean | undefined,
    any | null,
    boolean,
  ]) => {
    if (!newMesh || !newVisible) {
      disposeHighlight()
      playbackHighlightCache.clear()
      frontendIncrementalCache.clear()
      lastAllViewpointsRef = null
      lastBuildingMeshRef = null
      emit('highlight-loading', false)
      return
    }

    const usePlaybackMode = playbackPast !== null && playbackPast !== undefined

    const useAllCoverageMode = !usePlaybackMode && newAllViews && newAllViews.length > 0
    const useSingleMode = !usePlaybackMode && newView && !useAllCoverageMode

    if (usePlaybackMode) {
      const meshes = getMeshesToProcess(newMesh)
      const past = playbackPast || []
      const current = playbackCurrent || null
      runPlaybackHighlight(past, current, newMesh, meshes, !!playbackPaused)
      return
    }

    if (!useAllCoverageMode && !useSingleMode) {
      disposeHighlight()
      playbackHighlightCache.clear()
      frontendIncrementalCache.clear()
      lastAllViewpointsRef = null
      lastBuildingMeshRef = null
      emit('highlight-loading', false)
      return
    }

    const meshesToProcess: any[] = []
    if (newMesh.isGroup || newMesh.type === 'Group') {
      newMesh.traverse((child: any) => {
        if (child.isMesh || child.type === 'Mesh') meshesToProcess.push(child)
      })
    } else if (newMesh.isMesh || newMesh.type === 'Mesh') {
      meshesToProcess.push(newMesh)
    }

    // 仅选中变化：全局高亮已存在，只更新叠加层，不重新计算
    if (useAllCoverageMode && lastAllViewpointsRef === newAllViews && lastBuildingMeshRef === newMesh) {
      if (!newView) {
        disposeOverlayOnly()
        return
      }
      disposeOverlayOnly()
      let dir = newView.direction || { x: 0, y: -1, z: 0 }
      if ((!dir || (!dir.x && !dir.y && !dir.z)) && (newView as any).normal) {
        const orient = calculateCameraOrientationFromNormal((newView as any).normal)
        dir = orient.direction
      }
      // Use COVERAGE_CONFIG to match global highlight; ensures single-point overlay faces are always in global
      const vfovDeg = COVERAGE_CONFIG.vfov
      const hfovDeg = vfovToHfov(vfovDeg, COVERAGE_CONFIG.aspect)
      const h = computeDynamicHToMesh(newView.position, dir, newMesh, COVERAGE_CONFIG.fallbackH)
      const pyramid = buildPyramidFromCamera(newView.position, dir, vfovDeg, hfovDeg, h)
      for (const srcMesh of meshesToProcess) {
        if (typeof srcMesh.updateWorldMatrix === 'function') srcMesh.updateWorldMatrix(true, false)
        const selectedFaces = getVisibleMeshFacesByPyramid(pyramid, srcMesh, newView.position, { requireFacing: true })
        if (selectedFaces.length > 0) {
          const hmYellow = buildHighlightMeshFromFaces(srcMesh, selectedFaces, PASS_THROUGH_PLANES, SINGLE_VIEWPOINT_HIGHLIGHT_COLOR, NormalBlending)
          if (hmYellow) {
            hmYellow.renderOrder = 2
            srcMesh.add(hmYellow)
            overlayHighlightMeshes.value.push(hmYellow)
          }
        }
      }
      return
    }

    disposeHighlight()
    allCoverageRunId += 1 // 使进行中的异步全视点计算失效
    const hadGlobalBefore = lastAllViewpointsRef !== null
    lastAllViewpointsRef = null
    lastBuildingMeshRef = null
    emit('highlight-loading', false)

    if (useAllCoverageMode && newAllViews) {
      // 全视点覆盖模式：分批计算避免阻塞主线程
      // 仅首次进入全局高亮（用户点击 [View]）时显示 loading；路径变更（新增/删除点）时静默更新
      if (!hadGlobalBefore) emit('highlight-loading', true)
      const runId = allCoverageRunId
      const BATCH_SIZE = 8 // 每批处理的视点数
      const totalWork = meshesToProcess.length * newAllViews.length
      emit('highlight-loading-progress', 0, totalWork)
      const processBatch = (meshIdx: number, viewStart: number, accumulatedFaces: Set<number>) => {
        if (runId !== allCoverageRunId) {
          emit('highlight-loading', false)
          return
        }
        const srcMesh = meshesToProcess[meshIdx]
        if (!srcMesh) {
          emit('highlight-loading', false)
          return
        }
        const viewEnd = Math.min(viewStart + BATCH_SIZE, newAllViews.length)
        const loaded = meshIdx * newAllViews.length + viewEnd
        emit('highlight-loading-progress', loaded, totalWork)
        for (let i = viewStart; i < viewEnd; i++) {
          const v = newAllViews[i]
          const dir = v.direction || { x: 0, y: -1, z: 0 }
          const vfovDeg = COVERAGE_CONFIG.vfov
          const hfovDeg = vfovToHfov(vfovDeg, COVERAGE_CONFIG.aspect)
          const h = computeDynamicHToMesh(v.position, dir, newMesh, COVERAGE_CONFIG.fallbackH)
          const pyramid = buildPyramidFromCamera(v.position, dir, vfovDeg, hfovDeg, h)
          const faces = getVisibleMeshFacesByPyramid(pyramid, srcMesh, v.position, { requireFacing: true })
          faces.forEach(f => accumulatedFaces.add(f))
        }
        if (viewEnd < newAllViews.length) {
          requestAnimationFrame(() => processBatch(meshIdx, viewEnd, accumulatedFaces))
        } else {
          if (runId !== allCoverageRunId) {
            emit('highlight-loading', false)
            return
          }
          const globalFaces = Array.from(accumulatedFaces)
          let facesForGreen = globalFaces
          let facesForYellow: number[] = []
          if (newView && globalFaces.length > 0) {
            let dir = newView.direction || { x: 0, y: -1, z: 0 }
            if ((!dir || (!dir.x && !dir.y && !dir.z)) && (newView as any).normal) {
              const orient = calculateCameraOrientationFromNormal((newView as any).normal)
              dir = orient.direction
            }
            const vfovDeg = COVERAGE_CONFIG.vfov
            const hfovDeg = vfovToHfov(vfovDeg, COVERAGE_CONFIG.aspect)
            const h = computeDynamicHToMesh(newView.position, dir, newMesh, COVERAGE_CONFIG.fallbackH)
            const pyramid = buildPyramidFromCamera(newView.position, dir, vfovDeg, hfovDeg, h)
            const selectedFaces = getVisibleMeshFacesByPyramid(pyramid, srcMesh, newView.position, { requireFacing: true })
            facesForYellow = selectedFaces
            const selectedSet = new Set(selectedFaces)
            facesForGreen = globalFaces.filter(f => !selectedSet.has(f))
          }
          if (facesForGreen.length > 0) {
            const hmGreen = buildHighlightMeshFromFaces(srcMesh, facesForGreen, PASS_THROUGH_PLANES, ALL_COVERAGE_HIGHLIGHT_COLOR)
            if (hmGreen && runId === allCoverageRunId) {
              hmGreen.renderOrder = 1
              srcMesh.add(hmGreen)
              highlightMeshes.value.push(hmGreen)
            }
          }
          if (facesForYellow.length > 0) {
            const hmYellow = buildHighlightMeshFromFaces(srcMesh, facesForYellow, PASS_THROUGH_PLANES, SINGLE_VIEWPOINT_HIGHLIGHT_COLOR, NormalBlending)
            if (hmYellow && runId === allCoverageRunId) {
              hmYellow.renderOrder = 2
              srcMesh.add(hmYellow)
              overlayHighlightMeshes.value.push(hmYellow)
            }
          }
          const nextMeshIdx = meshIdx + 1
          if (nextMeshIdx < meshesToProcess.length && runId === allCoverageRunId) {
            requestAnimationFrame(() => processBatch(nextMeshIdx, 0, new Set()))
          } else {
            emit('highlight-loading-progress', totalWork, totalWork)
            lastAllViewpointsRef = newAllViews
            lastBuildingMeshRef = newMesh
            emit('highlight-loading', false)
          }
        }
      }
      try {
        for (const srcMesh of meshesToProcess) {
          if (typeof srcMesh.updateWorldMatrix === 'function') srcMesh.updateWorldMatrix(true, false)
        }
        if (meshesToProcess.length > 0) {
          requestAnimationFrame(() => processBatch(0, 0, new Set()))
        } else {
          lastAllViewpointsRef = newAllViews
          lastBuildingMeshRef = newMesh
          emit('highlight-loading', false)
        }
      } catch (e) {
        console.error('[BuildingHighlighter] 全视点覆盖高亮失败', e)
        emit('highlight-loading', false)
      }
      return
    }

    // 单视点模式
    if (!newView) return

    // direction compatibility (cameraView may contain normal instead of direction)
    let direction = newView.direction
    let up = newView.up
    if (
      (!direction || (!direction.x && !direction.y && !direction.z)) &&
      (newView as any).normal
    ) {
      const orient = calculateCameraOrientationFromNormal((newView as any).normal)
      direction = orient.direction
      up = orient.up
    }

    // Use COVERAGE_CONFIG for consistency with global highlight; single-point faces must appear in global
    const vfovDeg = COVERAGE_CONFIG.vfov
    const hfovDeg = vfovToHfov(vfovDeg, COVERAGE_CONFIG.aspect)
    const dir = direction || { x: 0, y: -1, z: 0 }
    const h = computeDynamicHToMesh(newView.position, dir, newMesh, COVERAGE_CONFIG.fallbackH)
    const pyramid = buildPyramidFromCamera(newView.position, dir, vfovDeg, hfovDeg, h)
    const clipPlanes = buildPyramidClipPlanes(pyramid)

    // 尝试使用后端API
    if (useBackend.value) {
      try {
        const viewpoint = {
          position: newView.position,
          direction: dir,
          up: up || { x: 0, y: 0, z: 1 },
          fov: vfovDeg,
          aspect: COVERAGE_CONFIG.aspect,
          near: newView.near || CAMERA_CONFIG.near,
          far: h,
        }

        const backendResult = await BackendHighlightService.calculateHighlight(viewpoint, '1')

        if (backendResult) {
          // 使用后端结果
          const facesToHighlight = backendResult.visibleFaceIndices

          const meshesToProcess: any[] = []
          if (newMesh.isGroup || newMesh.type === 'Group') {
            newMesh.traverse((child: any) => {
              if (child.isMesh || child.type === 'Mesh') meshesToProcess.push(child)
            })
          } else if (newMesh.isMesh || newMesh.type === 'Mesh') {
            meshesToProcess.push(newMesh)
          }

          for (const srcMesh of meshesToProcess) {
        const hm = buildHighlightMeshFromFaces(srcMesh, facesToHighlight, PASS_THROUGH_PLANES, SINGLE_VIEWPOINT_HIGHLIGHT_COLOR, NormalBlending)
        if (!hm) continue

            srcMesh.add(hm)
            highlightMeshes.value.push(hm)

            if (props.debugMarkers) {
              const marker = buildDebugMarkersFromFaces(srcMesh, facesToHighlight)
              if (marker) {
                srcMesh.add(marker)
                markerEntities.value.push(marker)
              }
            }
          }

          return // 后端模式成功,退出
        }
      } catch (error) {
        console.warn('[BuildingHighlighter] 后端高亮失败,降级到本地:', error)
        useBackend.value = false
      }
    }

    // 本地模式计算
    try {
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
        // Do not require face normal facing camera; for coverage/highlight this tends to under-count
        const visibleFaces = getVisibleMeshFacesByPyramid(pyramid, srcMesh, newView.position, { requireFacing: true })
        let facesToHighlight = visibleFaces

        if (!facesToHighlight || facesToHighlight.length === 0) {
          if (props.fallbackCount > 0) {
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

        const hm = buildHighlightMeshFromFaces(srcMesh, facesToHighlight, PASS_THROUGH_PLANES, SINGLE_VIEWPOINT_HIGHLIGHT_COLOR, NormalBlending)
        if (!hm) {
          console.warn('[BuildingHighlighter] 创建高亮mesh失败，faces数量:', facesToHighlight.length)
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
      console.error('[BuildingHighlighter] 更新失败', e)
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