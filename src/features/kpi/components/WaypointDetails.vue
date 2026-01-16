<template>
  <div class="detail-section">
    <div class="section-header">Waypoint Details</div>
    <div class="section-content">
      <div class="data-row">
        <span class="data-label">Waypoint</span>
        <span class="data-value">{{ waypoint.name }}</span>
      </div>
      <div class="data-row">
        <span class="data-label">Coordinates (Lat, Lon, Alt(mm)):</span>
        <div class="coordinate-fields">
          <div class="coordinate-field">
            <span class="coordinate-label">Latitude</span>
            <div class="coordinate-value">{{ waypoint.latitude }}</div>
          </div>
          <div class="coordinate-field">
            <span class="coordinate-label">Longitude</span>
            <div class="coordinate-value">{{ waypoint.longitude }}</div>
          </div>
          <div class="coordinate-field">
            <span class="coordinate-label">Altitude (mm)</span>
            <div class="coordinate-value">{{ waypoint.altitude }}</div>
          </div>
        </div>
      </div>
      <div class="data-row">
        <span class="data-label">Distance from Start(km)</span>
        <span class="data-value">{{ waypoint.distanceFromStart }}</span>
      </div>
      <div class="data-row">
        <span class="data-label">Speed(m/s)</span>
        <span class="data-value">{{ waypoint.speed }}</span>
      </div>
      <div class="data-row">
        <span class="data-label">Estimated Time(min)</span>
        <span class="data-value">{{ waypoint.estimatedTime }}</span>
      </div>
      <div class="data-row">
        <span class="data-label">Length (Prev → This)</span>
        <span class="data-value">{{ waypoint.segmentLength }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Waypoint } from '../types/kpi'

interface Props {
  waypoint: Waypoint
}

defineProps<Props>()
</script>

<style scoped>
.detail-section:not(:first-child) {
  border-top: 1px solid var(--glass-border);
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
}

.detail-section:first-child .section-header {
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
}

.section-content {
  padding: 16px;
  background: var(--glass-bg);
}

.data-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.data-row:last-child {
  margin-bottom: 0;
}

.data-label {
  font-size: 11px;
  color: var(--text-tertiary);
  font-weight: var(--font-weight-medium);
  letter-spacing: var(--letter-spacing-wide);
  text-transform: uppercase;
}

.data-value {
  font-size: 15px;
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
  font-family: var(--font-family-mono);
}

.coordinate-fields {
  display: flex;
  gap: 8px;
}

.coordinate-field {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.coordinate-label {
  font-size: 10px;
  color: var(--text-tertiary);
  font-weight: var(--font-weight-medium);
  letter-spacing: var(--letter-spacing-wide);
  text-transform: uppercase;
}

.coordinate-value {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--glass-border);
  padding: 8px;
  border-radius: var(--radius-xs);
  font-size: 13px;
  color: var(--text-primary);
  font-family: var(--font-family-mono);
  min-height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-base);
}

.coordinate-value:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: var(--glass-border-hover);
}
</style>

