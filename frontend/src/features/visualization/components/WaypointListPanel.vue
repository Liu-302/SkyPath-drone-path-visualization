<template>
  <div class="waypoint-panel" :class="{ collapsed: isCollapsed, disabled }">
    <div class="panel-header" @click="toggleCollapsed">
      <span class="panel-title">Viewpoints</span>
      <span class="toggle-icon">{{ isCollapsed ? '▶' : '▼' }}</span>
    </div>
    <div v-show="!isCollapsed" class="panel-content">
      <ul ref="listRef" class="waypoint-list">
        <li
          v-for="(p, index) in waypoints"
          :key="p.id"
          :class="{ active: selectedWaypointIndex === index }"
          :data-index="index"
          @click="!disabled && emit('selectWaypoint', index)"
        >
          Viewpoint {{ index + 1 }}
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'

const collapsed = ref(false)
const listRef = ref<HTMLUListElement | null>(null)

const props = withDefaults(
  defineProps<{
    selectedWaypointIndex: number | null
    waypoints: any[]
    disabled?: boolean
    /** 播放状态下强制收起；停止后恢复展开 */
    isPlaybackMode?: boolean
  }>(),
  { disabled: false, isPlaybackMode: false }
)

const emit = defineEmits<{
  selectWaypoint: [index: number]
}>()

const userCollapsed = ref(false)
const isCollapsed = computed(() => props.isPlaybackMode || userCollapsed.value)
function toggleCollapsed() {
  if (props.disabled) return
  userCollapsed.value = !userCollapsed.value
}

watch(() => props.isPlaybackMode, (playing) => {
  if (!playing) userCollapsed.value = false
})

watch(() => props.selectedWaypointIndex, (index) => {
  if (index === null || !listRef.value || isCollapsed.value) return
  nextTick(() => {
    const el = listRef.value?.querySelector(`li[data-index="${index}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  })
})
</script>

<style scoped>
.waypoint-panel {
  position: absolute;
  top: 190px; /* 往上移 */
  right: 440px; /* 往左移 */
  width: 130px;
  height: 280px;
  z-index: 1000;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: var(--radius-sm);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: fadeIn 0.6s ease-out;
  transition: height 0.25s ease;
}

.waypoint-panel.collapsed {
  height: 40px;
}

.panel-header {
  padding: 10px 14px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
  user-select: none;
  flex-shrink: 0;
  background: rgba(0, 0, 0, 0.2);
}

.panel-header:hover {
  background: rgba(255, 255, 255, 0.05);
}

.toggle-icon {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.6);
}

.panel-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 8px 0;
}

.waypoint-list {
  list-style: none;
  padding: 0 10px;
  margin: 0;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.waypoint-list li {
  padding: 6px 10px;
  cursor: pointer;
  font-size: 13px;
  color: #ccc;
  border-radius: 4px;
  margin-bottom: 2px;
  transition: background 0.2s;
}

.waypoint-list li:hover {
  background: rgba(255, 255, 255, 0.1);
}

.waypoint-panel.disabled {
  pointer-events: none;
  opacity: 0.5;
}

.waypoint-list li.active {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  border-left: 3px solid rgba(255, 255, 255, 0.9);
}

.waypoint-list::-webkit-scrollbar {
  width: 4px;
}
.waypoint-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
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
