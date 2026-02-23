<template>
  <div class="playback-timeline">
    <div class="timeline-row">
      <div class="time-and-speed">
        <div class="time-display">
          <span class="time-current">{{ formatTime(currentTimeSeconds) }}</span>
          <span class="time-separator">/</span>
          <span class="time-total">{{ formatTime(totalTimeSeconds) }}</span>
        </div>
        <div class="speed-wrap" ref="speedWrapRef">
          <button
            type="button"
            class="speed-btn"
            :class="{ active: speedMenuOpen }"
            @click="speedMenuOpen = !speedMenuOpen"
          >
            {{ store.playbackSpeed }}x
          </button>
          <div v-show="speedMenuOpen" class="speed-menu">
            <button
              v-for="s in SPEED_OPTIONS"
              :key="s"
              type="button"
              class="speed-option"
              :class="{ selected: store.playbackSpeed === s }"
              @click="onSpeedSelect(s)"
            >
              {{ s }}x
            </button>
          </div>
        </div>
      </div>
      <div class="waypoint-input-wrap">
        <span class="waypoint-label">Waypoint</span>
        <input
          ref="waypointInputRef"
          v-model.number="waypointInputValue"
          type="number"
          :min="1"
          :max="waypointCount"
          class="waypoint-input"
          @blur="onWaypointInputBlur"
          @keydown.enter="onWaypointInputBlur"
        />
        <span class="waypoint-total">/ {{ waypointCount }}</span>
      </div>
    </div>
    <div class="progress-row">
      <div
        ref="trackRef"
        class="progress-track"
        @mousedown="onTrackMouseDown"
      >
        <div class="progress-fill" :style="{ width: progressPercent + '%' }" />
        <div class="progress-thumb" :style="{ left: progressPercent + '%' }" />
      </div>
    </div>
    <div class="time-labels">
      <span>0:00</span>
      <span>{{ formatTime(totalTimeSeconds) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useDatasetStore } from '@/stores/dataset'
import { distance3D } from '@/shared/utils/geometry'
import { ENERGY_CONFIG } from '@/shared/constants/constants'

const SPEED_OPTIONS = [1, 1.5, 2, 2.5]

const store = useDatasetStore()
const trackRef = ref<HTMLElement | null>(null)
const waypointInputRef = ref<HTMLInputElement | null>(null)
const speedWrapRef = ref<HTMLElement | null>(null)
const speedMenuOpen = ref(false)

function onSpeedSelect(speed: number) {
  store.setPlaybackSpeed(speed)
  speedMenuOpen.value = false
}

function onDocumentClick(e: MouseEvent) {
  if (speedWrapRef.value && !speedWrapRef.value.contains(e.target as Node)) {
    speedMenuOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
})

const waypointCount = computed(() => Math.max(1, store.parsedPoints.length))

const totalDistance = computed(() => {
  const pts = store.parsedPoints
  if (pts.length < 2) return 0
  let d = 0
  for (let i = 1; i < pts.length; i++) {
    d += distance3D(pts[i - 1], pts[i])
  }
  return d
})

const totalMissionTimeSeconds = computed(() => {
  if (totalDistance.value <= 0) return 0
  return totalDistance.value / (ENERGY_CONFIG.speed || 5)
})
/** 总时长 = 任务时长，不随倍速改变 */
const totalTimeSeconds = computed(() => totalMissionTimeSeconds.value)

const segmentDistances = computed(() => {
  const pts = store.parsedPoints
  const segs: number[] = [0]
  for (let i = 1; i < pts.length; i++) {
    segs.push(segs[i - 1] + distance3D(pts[i - 1], pts[i]))
  }
  return segs
})

function indexToMissionTime(idx: number, segs: number[], totalDist: number, totalTime: number): number {
  if (totalDist <= 0 || totalTime <= 0) return 0
  const i0 = Math.floor(idx)
  const i1 = Math.min(i0 + 1, segs.length - 1)
  const alpha = idx - i0
  const dist = segs[i0] + alpha * (segs[i1] - segs[i0])
  return (dist / totalDist) * totalTime
}

/** 当前进度 = 任务时间（0~24min），不随倍速改变 */
const currentTimeSeconds = computed(() => {
  const pts = store.parsedPoints
  if (pts.length < 2) return 0
  const segs = segmentDistances.value
  const totalDist = totalDistance.value
  const totalTime = totalMissionTimeSeconds.value
  return indexToMissionTime(store.playbackIndex, segs, totalDist, totalTime)
})

const progressPercent = computed(() => {
  const total = totalTimeSeconds.value
  if (!total || total <= 0) return 0
  return Math.min(100, (currentTimeSeconds.value / total) * 100)
})

const waypointInputValue = computed({
  get: () => Math.floor(store.playbackIndex) + 1,
  set: (v: number) => {
    const n = Math.max(1, Math.min(Math.floor(v) || 1, waypointCount.value))
    store.setPlaybackIndex(n - 1)
  },
})

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function onWaypointInputBlur() {
  const v = waypointInputRef.value
  if (!v) return
  const n = parseInt(String(v.value), 10)
  if (!Number.isNaN(n) && n >= 1 && n <= waypointCount.value) {
    store.setPlaybackIndex(n - 1)
  }
}

function onTrackMouseDown(e: MouseEvent) {
  if (!trackRef.value) return
  const rect = trackRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const pct = Math.max(0, Math.min(1, x / rect.width))
  const dist = pct * totalDistance.value
  const segs = segmentDistances.value
  if (segs.length < 2) return
  let idx = 0
  for (let i = 0; i < segs.length - 1; i++) {
    if (dist >= segs[i] && dist <= segs[i + 1]) {
      const segLen = segs[i + 1] - segs[i]
      idx = segLen > 0 ? i + (dist - segs[i]) / segLen : i
      break
    }
    if (dist < segs[i]) {
      idx = i
      break
    }
    idx = segs.length - 1
  }
  store.setPlaybackIndex(idx)

  const onMouseMove = (e2: MouseEvent) => {
    const rect2 = trackRef.value?.getBoundingClientRect()
    if (!rect2) return
    const x2 = e2.clientX - rect2.left
    const pct2 = Math.max(0, Math.min(1, x2 / rect2.width))
    const dist2 = pct2 * totalDistance.value
    const segs2 = segmentDistances.value
    if (segs2.length < 2) return
    let idx2 = 0
    for (let i = 0; i < segs2.length - 1; i++) {
      if (dist2 >= segs2[i] && dist2 <= segs2[i + 1]) {
        const segLen = segs2[i + 1] - segs2[i]
        idx2 = segLen > 0 ? i + (dist2 - segs2[i]) / segLen : i
        break
      }
      if (dist2 < segs2[i]) {
        idx2 = i
        break
      }
      idx2 = segs2.length - 1
    }
    store.setPlaybackIndex(idx2)
  }

  const onMouseUp = () => {
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }

  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}
</script>

<style scoped>
.playback-timeline {
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.35);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.timeline-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.time-and-speed {
  display: flex;
  align-items: center;
  gap: 12px;
}

.time-display {
  font-size: 14px;
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
  font-family: var(--font-family-mono);
}

.speed-wrap {
  position: relative;
}

.speed-btn {
  padding: 4px 10px;
  font-size: 13px;
  font-weight: var(--font-weight-medium);
  color: rgba(255, 255, 255, 0.9);
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  cursor: pointer;
  font-family: var(--font-family-mono);
  transition: all 0.15s;
}

.speed-btn:hover,
.speed-btn.active {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.5);
}

.speed-menu {
  position: absolute;
  bottom: 100%;
  left: 0;
  margin-bottom: 4px;
  padding: 4px 0;
  background: rgba(30, 35, 45, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  min-width: 56px;
  z-index: 100;
}

.speed-option {
  display: block;
  width: 100%;
  padding: 6px 12px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  font-family: var(--font-family-mono);
  transition: background 0.1s;
}

.speed-option:hover {
  background: rgba(255, 255, 255, 0.1);
}

.speed-option.selected {
  background: rgba(255, 255, 255, 0.25);
  color: #fff;
}

.time-current {
  color: rgba(255, 255, 255, 0.95);
}

.time-separator {
  margin: 0 4px;
  color: rgba(255, 255, 255, 0.5);
}

.time-total {
  color: rgba(255, 255, 255, 0.6);
}

.waypoint-input-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-secondary);
}

.waypoint-label {
  color: rgba(255, 255, 255, 0.7);
}

.waypoint-input {
  width: 36px;
  padding: 4px 6px;
  font-size: 13px;
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 4px;
  text-align: center;
  font-family: var(--font-family-mono);
}

.waypoint-input:focus {
  outline: none;
  border-color: rgba(255, 255, 255, 0.5);
}

.waypoint-input::-webkit-inner-spin-button,
.waypoint-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.waypoint-input[type='number'] {
  -moz-appearance: textfield;
}

.waypoint-total {
  color: rgba(255, 255, 255, 0.5);
}

.progress-row {
  margin-bottom: 4px;
}

.progress-track {
  position: relative;
  height: 8px;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  cursor: pointer;
  overflow: visible;
}

.progress-fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0.9));
  border-radius: 4px;
  transition: width 0.05s linear;
}

.progress-thumb {
  position: absolute;
  top: 50%;
  width: 14px;
  height: 14px;
  margin-left: -7px;
  margin-top: -7px;
  background: #fff;
  border-radius: 50%;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
  pointer-events: none;
  transition: left 0.05s linear;
}

.time-labels {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
  font-family: var(--font-family-mono);
}
</style>
