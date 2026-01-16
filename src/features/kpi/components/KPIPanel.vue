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
            :viewpoint="viewpointData"
            :safety="safetyData"
          />
        </template>
        
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
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

interface Props {
  buildingModel?: Object3D | null
}

const props = withDefaults(defineProps<Props>(), {
  buildingModel: null,
})

const datasetStore = useDatasetStore()
const kpiStore = useKpiStore()
// 可配置的电池容量（Wh）- 基于DJI Phantom 4 Pro官方规格
const batteryCapacity = ref(89.2) // 官方规格：89.2 Wh（5870 mAh × 15.2 V）

const waypointCount = computed(() => datasetStore.parsedPoints.length)

const { selectedWaypointIndex } = useWaypointSelection(() => waypointCount.value)

const { flightData, safetyStatusClass } = useFlightSummary(
  () => datasetStore.parsedPoints,
  () => kpiStore.kpiMetrics,
  batteryCapacity,
)

const {
  selectedWaypoint,
  viewpointData,
  safetyData,
} = useWaypointDetails(
  () => datasetStore.parsedPoints,
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
})

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


.section-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.15);
  margin: 24px 0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

/* 区域标题 */
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