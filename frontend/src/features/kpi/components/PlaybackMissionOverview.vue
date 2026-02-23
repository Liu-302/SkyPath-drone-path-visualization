<template>
  <div class="mission-panel">
    <div class="section-header">Playback</div>
    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">Progress</span>
        <span class="info-value">{{ currentWaypoint }} / {{ totalWaypoints }}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Mission Time</span>
        <span class="info-value">{{ usedTimeDisplay }} / {{ totalTimeDisplay }}</span>
      </div>
      <div class="info-item" title="Coverage achieved by waypoints flown so far. Matches Mission Overview when playback completes.">
        <span class="info-label">Coverage Rate</span>
        <span class="info-value">{{ cumulativeCoverageDisplay }}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Speed</span>
        <span class="info-value">{{ playbackSpeed }}x</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  cumulativeCoverage: number | null
  flownDistance: number
  usedTimeSeconds: number
  currentWaypointIndex: number
  totalWaypoints: number
  totalTimeSeconds: number
  playbackSpeed?: number
}>()

const currentWaypoint = computed(() =>
  props.totalWaypoints <= 0 ? 0 : Math.min(Math.floor(props.currentWaypointIndex) + 1, props.totalWaypoints)
)
const totalWaypoints = computed(() => props.totalWaypoints)

const cumulativeCoverageDisplay = computed(() => {
  const v = props.cumulativeCoverage
  if (v === null || v === undefined || Number.isNaN(v) || !Number.isFinite(v)) return '0.0%'
  return `${Math.max(0, Math.min(100, v)).toFixed(1)}%`
})

const usedTimeDisplay = computed(() => {
  const m = Math.floor(props.usedTimeSeconds / 60)
  const s = Math.floor(props.usedTimeSeconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
})

const totalTimeDisplay = computed(() => {
  const m = Math.floor(props.totalTimeSeconds / 60)
  const s = Math.floor(props.totalTimeSeconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
})

const playbackSpeed = computed(() => props.playbackSpeed ?? 1)
</script>

<style scoped>
/* 与 MissionOverview 完全一致的样式 */
.mission-panel {
  margin-bottom: 24px;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.section-header {
  font-size: 13px;
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.9);
  padding: 14px 16px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.04) 100%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  background: var(--glass-bg);
  padding: 16px;
  border-radius: 0 0 var(--radius-sm) var(--radius-sm);
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
}

.info-label {
  font-size: 13px;
  color: var(--text-tertiary);
  font-weight: var(--font-weight-medium);
  letter-spacing: var(--letter-spacing-wide);
}

.info-value {
  font-size: 16px;
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  font-family: var(--font-family-mono);
  display: inline-flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 6px;
  white-space: nowrap;
}
</style>
