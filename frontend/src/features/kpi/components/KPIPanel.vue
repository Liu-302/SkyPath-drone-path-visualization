<template>
  <div class="kpi-panel">
    <KPIHeader
      :disabled="isCalculating"
      @play="handlePlay"
      @pause="handlePause"
      @stop="handleStop"
    />

    <!-- 如果发现数据错误就会出现这个panel -->
    <CalculationStatus
      :visible="hasError"
      :message="errorMessage"
      @retry="retryCalculation"
    />

    <!-- 撤销/重置按钮 -->
    <div class="undo-redo-bar">
      <button
        class="undo-button"
        :disabled="!datasetStore.canUndo()"
        @click="handleUndo"
        title="Undo (Ctrl+Z)"
      >
        <span class="button-text">Undo</span>
        <span class="shortcut-hint">(Ctrl+Z)</span>
      </button>
      <button
        class="redo-button"
        :disabled="!datasetStore.canRedo()"
        @click="handleRedo"
        title="Redo (Ctrl+Shift+Z)"
      >
        <span class="button-text">Redo</span>
        <span class="shortcut-hint">(Ctrl+Shift+Z)</span>
      </button>
    </div>

    <!-- Flight panel 直接显示数据 -->
    <div class="panel-content">
      <div class="panel-container">

        <MissionOverview
          :flight-data="flightData"
          :safety-status-class="safetyStatusClass"
          @view-coverage="viewCoverage"
          @view-overlap="viewOverlap"
          @view-safety="viewSafety"
        />

        <!-- 航点详情面板 - 只在选中航点时显示 -->
        <template v-if="selectedWaypointIndex !== null">
          <div class="section-divider"></div>
          <WaypointDetailGroup
            :waypoint="selectedWaypoint"
            :waypoint-index="selectedWaypointIndex"
            :viewpoint="viewpointData"
            :viewpoint-index="selectedWaypointIndex"
            :safety="safetyData"
          />
        </template>
        
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useDatasetStore } from '@/stores/dataset'
import { useKpiStore } from '@/stores/kpi'
import type { Object3D } from 'three'
import MissionOverview from './MissionOverview.vue'
import WaypointDetailGroup from './WaypointDetailGroup.vue'
import KPIHeader from './KPIHeader.vue'
import CalculationStatus from './CalculationStatus.vue'
import { useKpiCalculation } from '../composables/useKpiCalculation'
import { useWaypointSelection } from '../composables/useWaypointSelection'
import { useWaypointDetails } from '../composables/useWaypointDetails'
import { useKpiPlayback } from '../composables/useKpiPlayback'
import { useFlightSummary } from '../composables/useFlightSummary'

// 防抖函数
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  return function (this: any, ...args: Parameters<T>) {
    if (timeout !== null) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(() => {
      func.apply(this, args)
      timeout = null
    }, wait)
  }
}

interface Props {
  buildingModel?: Object3D | null
  recalculateKpi?: () => Promise<void>
}

const props = withDefaults(defineProps<Props>(), {
  buildingModel: null,
  recalculateKpi: undefined,
})

const datasetStore = useDatasetStore()
const kpiStore = useKpiStore()
// 可配置的电池容量（Wh）- 基于DJI Phantom 4 Pro官方规格
const batteryCapacity = ref(89.2) // 官方规格：89.2 Wh（5870 mAh × 15.2 V）

const waypointCount = computed(() => datasetStore.parsedPoints.length)

const { selectedWaypointIndex } = useWaypointSelection(() => waypointCount.value)

const { flightData, safetyStatusClass } = useFlightSummary(
  () => datasetStore.parsedPoints.map(p => ({
    x: p.x,
    y: p.y,
    z: p.z
  })),
  () => kpiStore.kpiMetrics,
  batteryCapacity,
)

const {
  selectedWaypoint,
  viewpointData,
  safetyData,
} = useWaypointDetails(
  () => datasetStore.parsedPoints.map(p => ({
    x: p.x,
    y: p.y,
    z: p.z,
    normal: p.normal
  })),
  selectedWaypointIndex,
  {
    batteryCapacity,
    buildingModel: computed(() => props.buildingModel),
  }
)


const {
  handlePlay,
  handlePause,
  handleStop,
  viewCoverage,
  viewOverlap,
  viewSafety,
} = useKpiPlayback()

const updateFlightData = () => {
  // KPI 数据已由 useFlightSummary 自动计算，这里保留占位以便后续扩展
}

const {
  isCalculating,
  hasError,
  errorMessage,
  startCalculation,
  retryCalculation,
} = useKpiCalculation({
  onStart: () => {
    updateFlightData()
  },
})

onMounted(() => {
  // console.log('KPI Panel mounted，自动显示KPI数据')
  startCalculation()

  // 监听键盘快捷键
  window.addEventListener('keydown', handleKeyboard)
})

// 清理键盘监听
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyboard)
})

// 处理键盘快捷键
const handleKeyboard = (event: KeyboardEvent) => {
  // Ctrl+Z 撤销
  if (event.ctrlKey && !event.shiftKey && event.key === 'z') {
    event.preventDefault()
    handleUndo()
  }
  // Ctrl+Shift+Z 重做
  if (event.ctrlKey && event.shiftKey && event.key === 'Z') {
    event.preventDefault()
    handleRedo()
  }
}

// 撤销处理
const handleUndo = () => {
  datasetStore.undo()
}

// 重做处理
const handleRedo = () => {
  datasetStore.redo()
}

// 监听路径点变化，自动重新计算KPI
// 使用更长的防抖延迟，避免频繁计算导致卡顿
watch(
  () => datasetStore.parsedPoints,
  debounce(() => {
    if (datasetStore.parsedPoints.length > 0 && props.recalculateKpi) {
      console.log('Waypoints changed, recalculating KPI')
      // 使用 requestIdleCallback 或 setTimeout 确保计算不会阻塞 UI
      // 优先使用 requestIdleCallback，如果浏览器不支持则使用 setTimeout
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(() => {
          props.recalculateKpi?.()
        }, { timeout: 1000 })
      } else {
      setTimeout(() => {
        props.recalculateKpi?.()
        }, 50)
      }
    }
  }, 500), // 增加到 500ms，减少计算频率，提升性能
  { deep: true }
)

// 监听路径点变化，清空历史记录（当重新导入数据时）
watch(
  () => datasetStore.parsedPoints.length,
  (newLength, oldLength) => {
    // 如果路径点数量发生了较大变化（可能是重新导入了文件），清空历史记录
    if (oldLength !== undefined && Math.abs(newLength - oldLength) > 0) {
      // 这里可以根据实际需求判断是否清空历史
      // 暂时不自动清空，允许用户在不同文件间操作
      // datasetStore.clearHistory()
    }
  }
)

// 监听KPI计算状态（不再设置全局光标，避免界面卡顿感）
// 计算状态由 KPIHeader 组件显示，不需要全局光标
watch(
  () => kpiStore.isCalculating,
  (isCalculating) => {
    // 移除全局光标设置，避免整个页面看起来卡顿
    // 计算状态由 KPIHeader 的加载指示器显示即可
  }
)

defineExpose({
  startCalculation,
})

</script>

<style scoped>
.kpi-panel {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 420px;
  height: 100%;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border-left: 1.5px solid rgba(255, 255, 255, 0.3);
  box-shadow: -3px 0 20px rgba(0, 0, 0, 0.5), inset -1px 0 0 rgba(255, 255, 255, 0.15);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  color: var(--text-primary);
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
}

.panel-content::-webkit-scrollbar {
  width: 6px;
}

.panel-content::-webkit-scrollbar-track {
  background: transparent;
}

.panel-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-full);
}

.panel-content::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}

.panel-container {
  padding: 24px;
}

/* Undo/Redo按钮栏 */
.undo-redo-bar {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.undo-button,
.redo-button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-xs);
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all var(--transition-base);
}

.undo-button:hover:not(:disabled),
.redo-button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.9);
}

.undo-button:active:not(:disabled),
.redo-button:active:not(:disabled) {
  transform: translateY(1px);
}

.undo-button:disabled,
.redo-button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.button-text {
  flex: 0;
}

.shortcut-hint {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  font-family: var(--font-family-mono);
}


.section-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.15);
  margin: 24px 0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

/* 区域标题 */
.section-header {
  font-size: 13px;
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.9);
  padding: 14px 16px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.04) 100%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

/* 区域内容 */
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
  font-size: 13px;
  color: var(--text-tertiary);
  font-weight: var(--font-weight-medium);
  letter-spacing: var(--letter-spacing-wide);
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
  font-size: 12px;
  color: var(--text-tertiary);
  font-weight: var(--font-weight-medium);
  letter-spacing: var(--letter-spacing-wide);
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

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
}
}

@media (max-height: 700px) {
  .panel-container {
    padding: 16px;
  }
  
  .section-divider {
    margin: 16px 0;
  }
  
  .flight-stat,
  .waypoint-section,
  .viewpoint-section,
  .safety-section {
    margin-bottom: 16px;
  }
}
</style>