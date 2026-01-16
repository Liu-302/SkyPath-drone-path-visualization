<template>
  <div class="detail-section">
    <div class="section-header">Safety & Diagnostic Data</div>
    <div class="section-content">
      <div class="data-row">
        <span class="data-label">Remaining Battery</span>
        <span class="data-value">{{ safetyData.remainingBattery }}%</span>
      </div>
      <div class="data-row">
        <span class="data-label">Minimum Distance to Obstacle(m)</span>
        <span class="data-value">{{ safetyData.minDistanceToObstacle !== null ? safetyData.minDistanceToObstacle.toFixed(1) : 'N/A' }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  safetyData: {
    remainingBattery: number
    minDistanceToObstacle: number | null
  }
}

defineProps<Props>()
</script>

<style scoped>
.detail-section {
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

.section-content {
  padding: 16px;
  background: var(--glass-bg);
  border-radius: 0 0 var(--radius-sm) var(--radius-sm);
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
</style>

