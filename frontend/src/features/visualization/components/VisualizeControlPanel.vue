<template>
  <!-- 顶部工具栏：Logo -->
  <div class="top-toolbar">
    <div class="toolbar-left">
      <!-- Logo -->
      <div class="logo">
        <img src="/SkyPath_logo.png" alt="SkyPath" class="logo-image" />
      </div>
    </div>
  </div>

  <!-- 左上角控制面板：其他功能 -->
  <div class="control-panel">
    <div class="control-item">
      <div class="path-toggle">
        <label>
          <input type="checkbox" v-model="modelValue" />
          <span>Show Path Lines</span>
        </label>
      </div>
    </div>

    <div class="control-item">
      <button class="reset-view-button" @click="$emit('resetView')" title="Reset Camera View">
        Reset View
      </button>
    </div>

    <div class="control-item">
      <button class="reimport-button" @click="$emit('reimport')" title="Re-import Data">
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
  resetView: []
}>()
</script>

<style scoped>
/* 顶部工具栏：Logo + 模式切换 */
.top-toolbar {
  position: absolute;
  top: 0;
  left: 0;
  right: 420px; /* 留出右侧KPI面板的空间（420px是KPI面板的宽度） */
  z-index: 1002;
  display: flex;
  align-items: center;
  padding: 4px 24px 4px 12px; /* 减少左边padding，使logo更靠左 */
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  animation: fadeIn 0.6s ease-out;
  height: 40px; /* 固定高度，与按钮高度一致 */
}

.toolbar-left {
  display: flex;
  align-items: center;
}

.logo {
  display: flex;
  align-items: center;
  height: 100%;
}

.logo-image {
  height: 28px; /* 与按钮高度一致 */
  width: auto;
  object-fit: contain;
  user-select: none;
  pointer-events: none;
}


/* 左上角控制面板：其他功能 */
.control-panel {
  position: absolute;
  top: 48px; /* 调整为工具栏高度 + 间距 */
  left: 24px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0;
  z-index: 1001;
  animation: fadeIn 0.6s ease-out;
}

.control-item {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: var(--radius-sm);
  transition: all var(--transition-base);
  overflow: hidden;
  width: fit-content;
}

.control-item:hover {
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(255, 255, 255, 0.35);
}

.control-item:first-child {
  padding: 12px 0px;
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

.control-item:not(:first-child) {
  margin-top: 12px;
}

.reset-view-button {
  padding: 12px 28px;
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

.reset-view-button:hover {
  background: var(--glass-bg-hover);
}

.reset-view-button:active {
  transform: translateY(1px);
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

.reimport-button {
  padding: 12px 32px;
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
  padding: 8px 20px;
  margin-top: 5px;
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

