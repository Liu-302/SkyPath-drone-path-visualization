<template>
  <div v-if="shouldShow" class="details-panel">
    <WaypointDetails v-if="waypoint && waypointIndex !== null" :waypoint="waypoint" :waypoint-index="waypointIndex!" />
    <ViewpointDetails v-if="viewpoint && viewpointIndex !== null" :viewpoint-data="viewpoint" :viewpoint-index="viewpointIndex!" />
    <SafetyDetails v-if="safety" :safety-data="safety" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import WaypointDetails from './WaypointDetails.vue'
import ViewpointDetails from './ViewpointDetails.vue'
import SafetyDetails from './SafetyDetails.vue'
import { Viewpoint } from '../types/kpi'
import type { WaypointDetail } from '../services/kpi-calculator'

interface Props {
  waypoint: WaypointDetail | null
  waypointIndex?: number | null
  viewpoint: Viewpoint | null
  viewpointIndex?: number | null
  safety: {
    remainingBattery: number
    minDistanceToObstacle: number | null
  } | null
}

const props = defineProps<Props>()

const shouldShow = computed(() => {
  return !!(props.waypoint || props.viewpoint || props.safety)
})
</script>

<style scoped>
.details-panel {
  margin-bottom: 24px;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}
</style>

