<template>
  <!-- 顶部工具栏：Logo + 插入航点 -->
  <div class="top-toolbar">
    <div class="toolbar-left">
      <div class="logo" role="button" tabindex="0" title="Back to Home" @click="emit('home')" @keydown.enter="emit('home')">
        <img src="/SkyPath_logo.png" alt="SkyPath" class="logo-image" />
      </div>
      <div class="toolbar-insert">
        <button
          type="button"
          class="toolbar-btn"
          :disabled="disabled || selectedWaypointIndex === null"
          title="Insert new waypoint before selected"
          @click="handleInsertBefore"
        >
          Insert Before
        </button>
        <button
          type="button"
          class="toolbar-btn"
          :disabled="disabled || selectedWaypointIndex === null"
          title="Insert new waypoint after selected"
          @click="handleInsertAfter"
        >
          Insert After
        </button>
        <button
          type="button"
          class="toolbar-btn toolbar-btn-danger"
          :disabled="disabled || selectedWaypointIndex === null"
          title="Delete selected waypoint"
          @click="handleDelete"
        >
          Delete
        </button>
        <div class="toolbar-divider"></div>
        <button
          type="button"
          class="toolbar-btn"
          :disabled="disabled"
          title="Reorder waypoints to minimize total distance (Start point fixed)"
          @click="handleOptimize"
        >
          Optimal Path
        </button>
        <button
          type="button"
          class="toolbar-btn"
          :disabled="disabled || waypointCount === 0"
          title="Export path as JSON"
          @click="handleExport"
        >
          Export Path
        </button>
        <div class="toolbar-divider"></div>
        <button
          type="button"
          class="toolbar-btn"
          :disabled="disabled || waypointCount === 0 || !isLoggedIn"
          title="Save to cloud"
          @click="emit('save')"
        >
          Save
        </button>
      </div>
    </div>
    <div class="toolbar-right">
      <button type="button" class="toolbar-btn" @click="emit('home')" title="Back to Home">
        Home
      </button>
      <div v-show="!disabled" class="toolbar-help">
        <div class="help-trigger" @click="showHelp = !showHelp">
          <span>How to Use</span>
          <span class="help-toggle">{{ showHelp ? '▼' : '▶' }}</span>
        </div>
        <div v-show="showHelp" class="help-dropdown">
          <div class="help-row"><span class="help-label">Left drag</span><span>Rotate view</span></div>
          <div class="help-row"><span class="help-label">Ctrl+Left drag</span><span>Pan</span></div>
          <div class="help-row"><span class="help-label">Scroll wheel</span><span>Zoom</span></div>
          <div class="help-row"><span class="help-label">Click waypoint</span><span>Select & view details</span></div>
        </div>
      </div>
      <button type="button" class="toolbar-btn toolbar-logout" @click="handleLogout" title="Logout">
        Logout
      </button>
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
      <button class="reset-view-button" :disabled="disabled" @click="emit('resetView')" title="Reset Camera View">
        Reset Camera
      </button>
    </div>

    <div class="control-item path-legend">
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
import { ref, computed } from 'vue'
import { useRouter } from '@fesjs/fes'
import { useAuthStore } from '@/stores/auth'
import { useDatasetStore } from '@/stores/dataset'

const router = useRouter()
const authStore = useAuthStore()
const datasetStore = useDatasetStore()

const waypointCount = computed(() => datasetStore.parsedPoints.length)
const isLoggedIn = computed(() => authStore.isLoggedIn)

function handleLogout() {
  authStore.logout()
  router.replace('/Login')
}

function handleExport() {
  const points = datasetStore.parsedPoints
  if (points.length === 0) return
  const data = points.map(p => ({
    id: p.id,
    x: p.x,
    y: p.y,
    z: p.z,
    normal: { x: p.normal.x, y: p.normal.y, z: p.normal.z }
  }))
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `path_export_${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

const modelValue = defineModel<boolean>({ required: true })
const showHelp = ref(false)

const props = withDefaults(
  defineProps<{
    selectedWaypointIndex: number | null
    disabled?: boolean
  }>(),
  { disabled: false }
)

const emit = defineEmits<{
  save: []
  home: []
  resetView: []
  insertBefore: [index: number]
  insertAfter: [index: number]
  delete: [index: number]
  optimize: []
}>()

// Handle insert before with type guard
const handleInsertBefore = () => {
  if (props.selectedWaypointIndex !== null) {
    emit('insertBefore', props.selectedWaypointIndex)
  }
}

// Handle insert after with type guard
const handleInsertAfter = () => {
  if (props.selectedWaypointIndex !== null) {
    emit('insertAfter', props.selectedWaypointIndex)
  }
}

// Handle delete with type guard
const handleDelete = () => {
  if (props.selectedWaypointIndex !== null) {
    emit('delete', props.selectedWaypointIndex)
  }
}

const handleOptimize = () => {
  emit('optimize')
}
</script>


<style scoped>
/* 顶部工具栏 */
.top-toolbar {
  position: absolute;
  top: 0;
  left: 0;
  right: 420px;
  z-index: 1002;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 24px 4px 12px;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  animation: fadeIn 0.6s ease-out;
  height: 40px;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.toolbar-insert {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-btn {
  padding: 6px 14px;
  font-size: 12px;
  font-weight: var(--font-weight-medium);
  letter-spacing: var(--letter-spacing-wide);
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-base);
}

.toolbar-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.35);
}

.toolbar-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
  pointer-events: none;
}

.toolbar-btn-danger {
  color: #f87171;
  border-color: rgba(248, 113, 113, 0.3);
}

.toolbar-btn-danger:hover:not(:disabled) {
  color: #fca5a5;
  background: rgba(248, 113, 113, 0.15);
  border-color: rgba(248, 113, 113, 0.5);
}

.toolbar-divider {
  width: 1px;
  height: 24px;
  background: rgba(255, 255, 255, 0.65);
  margin: 0 4px;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.logo {
  display: flex;
  align-items: center;
  height: 100%;
  cursor: pointer;
}

.logo-image {
  height: 28px;
  width: auto;
  object-fit: contain;
  user-select: none;
  pointer-events: none;
}

/* 左上角控制面板 */
.control-panel {
  position: absolute;
  top: 48px;
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
  width: 160px;
  padding: 12px 20px;
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

.reset-view-button:hover:not(:disabled) {
  background: var(--glass-bg-hover);
}

.reset-view-button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
  pointer-events: none;
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

.path-legend {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  padding: 8px 20px;
  background: transparent !important;
  border: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  box-shadow: none !important;
}

.path-legend:hover {
  background: transparent !important;
  border: none !important;
}

.path-legend .legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.path-legend .legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.path-legend .legend-start {
  background: #00ff00;
  box-shadow: 0 0 8px rgba(0, 255, 0, 0.5);
}

.path-legend .legend-end {
  background: #ff0000;
  box-shadow: 0 0 8px rgba(255, 0, 0, 0.5);
}

.toolbar-help {
  position: relative;
}

.help-trigger {
  padding: 6px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
  user-select: none;
  border-radius: var(--radius-xs);
}

.help-trigger:hover {
  background: rgba(255, 255, 255, 0.08);
}

.help-toggle {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.6);
}

.help-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  padding: 14px 18px;
  min-width: 280px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
  line-height: 1.8;
  background: rgba(23, 23, 24, 0.95);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: var(--radius-sm);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.08);
  z-index: 1003;
}

.help-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.help-label {
  color: rgba(255, 255, 255, 0.6);
  flex-shrink: 0;
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

