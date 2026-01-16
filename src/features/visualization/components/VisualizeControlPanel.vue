<template>
  <div class="control-panel">
    <div class="control-item">
      <div class="path-toggle">
        <label>
          <input type="checkbox" v-model="modelValue" />
          <span>Show Path Lines</span>
        </label>
      </div>
    </div>

    <div class="control-item reimport-container">
      <button class="reimport-button" @click="$emit('reimport')">
        Re-import
      </button>
    </div>

    <div class="path-legend">
      <span class="legend-item">
        <span class="legend-dot legend-start"></span>
        <span>Start</span>
      </span>
      <span class="legend-item">
        <span class="legend-dot legend-end"></span>
        <span>End</span>
      </span>
    </div>
  </div>
</template>
<script setup lang="ts">
const modelValue = defineModel<boolean>({ required: true })

defineEmits<{
  reimport: []
}>()
</script>

<style scoped>
.control-panel {
  position: absolute;
  top: 24px;
  left: 24px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  z-index: 1001;
  animation: fadeIn 0.6s ease-out;
}

.control-item {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  transition: all var(--transition-base);
  overflow: hidden;
}

.control-item:hover {
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(255, 255, 255, 0.12);
}

.control-item:first-child {
  padding: 12px 20px;
  background: transparent;
  border: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.control-item:first-child:hover {
  background: transparent;
  border: none;
  box-shadow: none;
}

.control-item:last-child {
  padding: 0;
}

.path-toggle {
  display: flex;
  align-items: center;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: var(--font-weight-medium);
  letter-spacing: var(--letter-spacing-wide);
  text-transform: uppercase;
}

.path-toggle label {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: default;
  margin: 0;
  pointer-events: none;
}

.path-toggle input[type='checkbox'] {
  margin: 0;
  width: 14px;
  height: 14px;
  cursor: pointer;
  pointer-events: auto;
  accent-color: rgba(255, 255, 255, 0.9);
  transition: all var(--transition-base);
  filter: grayscale(0);
}

.path-toggle input[type='checkbox']:hover {
  transform: scale(1.15);
}

.path-toggle label span {
  pointer-events: none;
}

.reimport-container {
  transform: translateX(24px);
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
  margin-top: -6px;
}

.reimport-container:hover {
  border-color: rgba(255, 255, 255, 0.25) !important;
}

.reimport-button {
  padding: 12px 24px;
  background: transparent;
  border: none;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 13px;
  font-weight: var(--font-weight-medium);
  letter-spacing: var(--letter-spacing-wide);
  text-transform: uppercase;
  transition: all var(--transition-base);
  display: block;
  text-align: center;
}

.reimport-button:hover {
  background: var(--glass-bg-hover);
}

.path-legend {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  margin-left: 45px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.legend-start {
  background: #00ff00;
  box-shadow: 0 0 8px rgba(0, 255, 0, 0.5);
}

.legend-end {
  background: #ff0000;
  box-shadow: 0 0 8px rgba(255, 0, 0, 0.5);
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>

