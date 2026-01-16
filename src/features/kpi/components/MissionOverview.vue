<template>
  <div class="mission-panel">
    <div class="section-header">Mission Overview</div>
    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">Total Flight Distance</span>
        <span class="info-value">{{ flightData.totalDistance }} km</span>
      </div>
      <div class="info-item">
        <span class="info-label">Number of Waypoints</span>
        <span class="info-value">{{ flightData.waypointCount }}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Mission Duration</span>
        <span class="info-value">{{ flightData.missionDuration }} min</span>
      </div>
      <div class="info-item">
        <span class="info-label">Estimated Energy Consumption</span>
        <span class="info-value">{{ flightData.energyConsumption }}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Coverage Rate</span>
        <span class="info-value">{{ flightData.coverageRate }}% <a href="#" class="info-link info-link-percentage" @click.prevent="viewCoverage">[View]</a></span>
      </div>
      <div class="info-item">
        <span class="info-label">Overlap Rate</span>
        <span class="info-value">{{ flightData.overlapRate }}% <a href="#" class="info-link info-link-percentage" @click.prevent="viewOverlap">[View]</a></span>
      </div>
      <div class="info-item">
        <span class="info-label">Safety Status</span>
        <span class="info-value status-warning" :class="safetyStatusClass">
          {{ flightData.safetyStatus }} <a href="#" class="info-link" @click.prevent="viewSafety">[View]</a>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  flightData: {
    totalDistance: string
    waypointCount: number
    missionDuration: string
    energyConsumption: string
    coverageRate: string
    overlapRate: string
    safetyStatus: string
  }
  safetyStatusClass: string
}

defineProps<Props>()

const emit = defineEmits<{
  viewCoverage: []
  viewOverlap: []
  viewSafety: []
}>()

const viewCoverage = () => {
  emit('viewCoverage')
}

const viewOverlap = () => {
  emit('viewOverlap')
}

const viewSafety = () => {
  emit('viewSafety')
}
</script>

<style scoped>
/* Mission Overview 面板 */
.mission-panel {
  margin-bottom: 24px;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.section-header {
  font-size: 11px;
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
  font-size: 11px;
  color: var(--text-tertiary);
  font-weight: var(--font-weight-medium);
  letter-spacing: var(--letter-spacing-wide);
  text-transform: uppercase;
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

.info-link {
  color: var(--text-primary);
  text-decoration: none;
  font-size: 11px;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity var(--transition-fast);
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
  flex-shrink: 0;
  transform: translateY(0.1em);
}

.info-link-percentage {
  transform: translateY(-0.1em);
}

.info-link:hover {
  opacity: 1;
  text-decoration: underline;
}

.status-warning {
  color: #fbbf24;
}

.status-safe {
  color: #34d399;
}

</style>

