<script setup lang="ts">
import { ref, watch, onUnmounted, shallowRef } from 'vue'
import { useLoop } from '@tresjs/core'
import { useDatasetStore } from '@/stores/dataset'
import { distance3D } from '@/shared/utils/geometry'
import { ENERGY_CONFIG } from '@/shared/constants/constants'
import * as THREE from 'three'

const store = useDatasetStore()

// 根据任务时间反推 playbackIndex，使时间一秒一秒递增
function getSegmentDistances(pts: { x: number; y: number; z: number }[]) {
  const segs: number[] = [0]
  for (let i = 1; i < pts.length; i++) segs.push(segs[i - 1] + distance3D(pts[i - 1], pts[i]))
  return segs
}
function missionTimeToIndex(missionTime: number, segs: number[], totalDist: number, totalTime: number): number {
  if (totalTime <= 0 || totalDist <= 0) return 0
  const dist = (missionTime / totalTime) * totalDist
  for (let i = 0; i < segs.length - 1; i++) {
    if (dist >= segs[i] && dist < segs[i + 1]) {
      const segLen = segs[i + 1] - segs[i]
      return segLen > 0 ? i + (dist - segs[i]) / segLen : i
    }
    if (dist < segs[i]) return i
  }
  return segs.length - 1
}
function indexToMissionTime(idx: number, segs: number[], totalDist: number, totalTime: number): number {
  if (totalDist <= 0 || totalTime <= 0) return 0
  const i0 = Math.floor(idx)
  const i1 = Math.min(i0 + 1, segs.length - 1)
  const alpha = idx - i0
  const dist = segs[i0] + alpha * (segs[i1] - segs[i0])
  return (dist / totalDist) * totalTime
}

// Use shallowRef for Three.js objects to avoid Vue reactivity overhead
const droneGroupRef = shallowRef<THREE.Group | null>(null)
const geometryRef = shallowRef<THREE.BufferGeometry | null>(null)
const activeSegmentGeometry = shallowRef<THREE.BufferGeometry | null>(null)
const internalLineRef = shallowRef<THREE.Line | null>(null)

// Initialize active segment geometry (dynamic part)
const initActiveSegment = () => {
  const geometry = new THREE.BufferGeometry()
  const positions = new Float32Array(6) // 2 points (x,y,z) * 2
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  activeSegmentGeometry.value = geometry
}
initActiveSegment()

// Initialize geometry from store points
const initGeometry = () => {
  if (store.parsedPoints.length < 2) return

  // 1. Convert all points to Vector3
  const points = store.parsedPoints.map(p => new THREE.Vector3(p.x, p.y, p.z))
  
  // 2. Create static geometry
  const geometry = new THREE.BufferGeometry().setFromPoints(points)
  
  // 3. Start invisible
  geometry.setDrawRange(0, 0)
  
  geometryRef.value = geometry
}

// Re-init when points change
watch(() => store.parsedPoints, () => {
  initGeometry()
}, { immediate: true })

const { onBeforeRender } = useLoop()

// Reuse vectors to prevent memory leaks
const currentPos = new THREE.Vector3()
const nextPos = new THREE.Vector3()
const exactPos = new THREE.Vector3()

let lastElapsedUpdate = 0
let localPlaybackIndex = 0
let frameCount = 0
onBeforeRender(({ delta }) => {
  if (!store.isPlaybackMode || !geometryRef.value) return

  const now = Date.now()
  if (store.isPaused) {
    store.playbackElapsedRealSeconds = store.playbackElapsedRealSecondsAtPause
    localPlaybackIndex = store.playbackIndex
  } else {
    const elapsed = store.playbackElapsedRealSecondsAtPause + (now - store.playbackLastResumeTimestamp) / 1000
    if (now - lastElapsedUpdate >= 150) {
      lastElapsedUpdate = now
      store.playbackElapsedRealSeconds = elapsed
    }
  }

  // 按真实经过时间驱动播放：missionTime = 真实秒数 × 倍速，确保 2x 时 16 分钟任务只需 8 分钟
  if (!store.isPaused && store.parsedPoints.length >= 2) {
    const pts = store.parsedPoints
    const segs = getSegmentDistances(pts)
    const totalDist = segs[segs.length - 1]
    const totalTime = totalDist / (ENERGY_CONFIG.speed || 5)
    const elapsedRealSeconds = store.playbackElapsedRealSecondsAtPause + (now - store.playbackLastResumeTimestamp) / 1000
    const missionTimeSeconds = elapsedRealSeconds * store.playbackSpeed
    const clampedMissionTime = Math.min(missionTimeSeconds, totalTime)
    // 到达终点时直接设为最后一个点，避免 missionTimeToIndex 因浮点误差返回 pts.length - 2
    localPlaybackIndex = clampedMissionTime >= totalTime - 1e-6
      ? pts.length - 1
      : missionTimeToIndex(clampedMissionTime, segs, totalDist, totalTime)
    // 确保播放到最后一个航点再结束；提前触发以避免浮点误差停在倒数第二个点
    const nearEnd = clampedMissionTime >= totalTime - 0.1 || localPlaybackIndex >= pts.length - 1.5
    if (nearEnd || localPlaybackIndex >= pts.length - 1 - 0.001) {
      store.pausePlaybackAtEnd()
      localPlaybackIndex = pts.length - 1
      store.playbackIndex = pts.length - 1 // 立即同步到 store，避免因 frameCount 未偶而停在倒数第二点
    }
    frameCount++
    if (frameCount % 2 === 0) store.playbackIndex = localPlaybackIndex
  }

  // Calculate current interpolated position
  const points = store.parsedPoints
  const maxIndex = points.length - 1
  const idx = localPlaybackIndex
  
  const currentIndex = Math.min(Math.floor(idx), maxIndex)
  const nextIndex = Math.min(currentIndex + 1, maxIndex)
  const alpha = idx - currentIndex // Fractional part [0, 1]

  // Ensure safe bounds
  if (currentIndex >= 0 && points[currentIndex]) {
    const p1 = points[currentIndex]
    
    // Position Update
    if (currentIndex < maxIndex) {
      const p2 = points[nextIndex]
      currentPos.set(p1.x, p1.y, p1.z)
      nextPos.set(p2.x, p2.y, p2.z)
      
      // Lerp for smooth movement
      exactPos.lerpVectors(currentPos, nextPos, alpha)
    } else {
      // End of path
      exactPos.set(p1.x, p1.y, p1.z)
    }

    // Apply to Drone（保持平行于 XZ 平面，机身始终水平）
    if (droneGroupRef.value) {
      droneGroupRef.value.position.copy(exactPos)
      droneGroupRef.value.rotation.set(0, 0, 0)
    }

    // Update Active Segment (Dynamic Trail from last waypoint to current drone pos)
    if (activeSegmentGeometry.value) {
      const positions = activeSegmentGeometry.value.attributes.position.array as Float32Array
      // Start point: current waypont
      positions[0] = p1.x
      positions[1] = p1.y
      positions[2] = p1.z
      // End point: current drone position
      positions[3] = exactPos.x
      positions[4] = exactPos.y
      positions[5] = exactPos.z
      
      activeSegmentGeometry.value.attributes.position.needsUpdate = true
      activeSegmentGeometry.value.setDrawRange(0, 2)
    }
  }

  // Update Trail (Blue Line)
  // Shows completed segments
  if (geometryRef.value) {
    const drawCount = Math.floor(idx) + 1
    geometryRef.value.setDrawRange(0, Math.max(0, drawCount))
  }
})

onUnmounted(() => {
  if (geometryRef.value) geometryRef.value.dispose()
  if (activeSegmentGeometry.value) activeSegmentGeometry.value.dispose()
})
</script>

<template>
  <TresGroup v-if="store.isPlaybackMode && geometryRef">
    
    <!-- Path Trail - 已扫过的线段（墨绿，区别于起点亮绿） -->
    <TresLine ref="internalLineRef" :geometry="geometryRef" :frustum-culled="false">
      <TresLineBasicMaterial :color="0x2d5a27" :linewidth="5" />
    </TresLine>
    
    <!-- Active Segment Trail - 当前飞行中的线段（墨绿） -->
    <TresLine v-if="activeSegmentGeometry" :geometry="activeSegmentGeometry" :frustum-culled="false">
      <TresLineBasicMaterial :color="0x2d5a27" :linewidth="5" />
    </TresLine>

    <!-- Drone Model (Simulated) - 蓝色 -->
    <TresGroup ref="droneGroupRef" :scale="[4.5, 4.5, 4.5]">
        <!-- 中间小圆柱（竖直立在中心） -->
        <TresMesh>
            <TresCylinderGeometry :args="[0.06, 0.06, 0.15, 12]" />
            <TresMeshStandardMaterial color="#2196F3" :metalness="0.5" :roughness="0.3" />
        </TresMesh>

        <!-- Arms -->
        <TresGroup :rotation-y="Math.PI / 4">
            <TresMesh>
                <TresBoxGeometry :args="[0.9, 0.06, 0.06]" />
                <TresMeshStandardMaterial color="#42A5F5" />
            </TresMesh>
             <TresMesh :rotation-y="Math.PI / 2">
                <TresBoxGeometry :args="[0.9, 0.06, 0.06]" />
                <TresMeshStandardMaterial color="#42A5F5" />
            </TresMesh>
        </TresGroup>

        <!-- Propellers -->
        <TresMesh :position="[0.32, 0.1, 0.32]">
             <TresCylinderGeometry :args="[0.25, 0.25, 0.02, 8]" />
             <TresMeshStandardMaterial color="#90CAF9" />
        </TresMesh>
        <TresMesh :position="[-0.32, 0.1, 0.32]">
             <TresCylinderGeometry :args="[0.25, 0.25, 0.02, 8]" />
             <TresMeshStandardMaterial color="#90CAF9" />
        </TresMesh>
        <TresMesh :position="[0.32, 0.1, -0.32]">
             <TresCylinderGeometry :args="[0.25, 0.25, 0.02, 8]" />
             <TresMeshStandardMaterial color="#90CAF9" />
        </TresMesh>
        <TresMesh :position="[-0.32, 0.1, -0.32]">
             <TresCylinderGeometry :args="[0.25, 0.25, 0.02, 8]" />
             <TresMeshStandardMaterial color="#90CAF9" />
        </TresMesh>
    </TresGroup>
    
  </TresGroup>
</template>