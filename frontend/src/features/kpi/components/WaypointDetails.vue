<template>
  <div class="detail-section">
    <div class="section-header">Waypoint Details</div>
    <div class="section-content">
      <div class="data-row">
        <span class="data-label">Waypoint</span>
        <span class="data-value">{{ waypoint.name }}</span>
      </div>
      <div class="data-row">
        <span class="data-label">Position (X, Y, Z m):</span>
        <div class="coordinate-fields">
          <div class="coordinate-field">
            <span class="coordinate-label">X</span>
            <input
              v-model.number="editableX"
              type="text"
              inputmode="numeric"
              pattern="-?\d*"
              step="1"
              :class="['coordinate-input', { 'invalid': !isXValid }]"
              @blur="updateCoordinates"
              @keydown.enter="($event.target as HTMLInputElement).blur()"
              @keydown="handleNumberInput"
              @wheel="handleWheel"
            />
          </div>
          <div class="coordinate-field">
            <span class="coordinate-label">Y</span>
            <input
              v-model.number="editableY"
              type="text"
              inputmode="numeric"
              pattern="-?\d*"
              step="1"
              :class="['coordinate-input', { 'invalid': !isYValid }]"
              @blur="updateCoordinates"
              @keydown.enter="($event.target as HTMLInputElement).blur()"
              @keydown="handleNumberInput"
              @wheel="handleWheel"
            />
          </div>
          <div class="coordinate-field">
            <span class="coordinate-label">Z</span>
            <input
              v-model.number="editableZ"
              type="text"
              inputmode="numeric"
              pattern="-?\d*"
              step="1"
              :class="['coordinate-input', { 'invalid': !isZValid }]"
              @blur="updateCoordinates"
              @keydown.enter="($event.target as HTMLInputElement).blur()"
              @keydown="handleNumberInput"
              @wheel="handleWheel"
            />
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
import { ref, watch, onMounted, computed } from 'vue'
import type { WaypointDetail } from '../services/kpi-calculator'
import { useDatasetStore } from '@/stores/dataset'

interface Props {
  waypoint: WaypointDetail
  waypointIndex: number
}

const props = defineProps<Props>()
const store = useDatasetStore()

// 可编辑的坐标值
const editableX = ref(0)
const editableY = ref(0)
const editableZ = ref(0)

// 是否忽略下一次props更新（防止watch覆盖用户输入）
const ignoreNextUpdate = ref(false)

// 验证状态
const isXValid = computed(() => Number.isFinite(editableX.value))
const isYValid = computed(() => Number.isFinite(editableY.value))
const isZValid = computed(() => Number.isFinite(editableZ.value))

// 初始化编辑值
onMounted(() => {
  editableX.value = Math.round(Number(props.waypoint.x))
  editableY.value = Math.round(Number(props.waypoint.y))
  editableZ.value = Math.round(Number(props.waypoint.z))
})

// 监听props变化，更新编辑值（不在编辑状态时才更新）
watch(() => props.waypoint, (newWaypoint) => {
  if (ignoreNextUpdate.value) {
    ignoreNextUpdate.value = false
    return
  }
  editableX.value = Math.round(Number(newWaypoint.x))
  editableY.value = Math.round(Number(newWaypoint.y))
  editableZ.value = Math.round(Number(newWaypoint.z))
}, { deep: true })

// 处理wheel事件，在输入框聚焦时阻止默认滚动行为
const handleWheel = (event: WheelEvent) => {
  const target = event.target as HTMLInputElement
  if (target === document.activeElement) {
    event.preventDefault()
  }
}

// 处理数字输入，只允许数字、负号和导航键
const handleNumberInput = (event: KeyboardEvent) => {
  const key = event.key

  // 允许的特殊键：退格、删除、左右箭头、Tab、Enter、负号（只能在开头）
  if (
    key === 'Backspace' ||
    key === 'Delete' ||
    key === 'ArrowLeft' ||
    key === 'ArrowRight' ||
    key === 'Tab' ||
    key === 'Enter'
  ) {
    return
  }

  // 允许负号（只能在输入框开头）
  if (key === '-') {
    const input = event.target as HTMLInputElement
    if (input.selectionStart === 0 && !input.value.includes('-')) {
      return
    } else {
      event.preventDefault()
    }
    return
  }

  // 只允许数字
  if (key >= '0' && key <= '9') {
    return
  }

  // 其他按键都阻止
  event.preventDefault()
}

// 更新坐标到store
const updateCoordinates = () => {
  const point = store.parsedPoints[props.waypointIndex]
  if (!point) return

  // 验证输入值
  if (!isXValid.value || !isYValid.value || !isZValid.value) {
    console.warn('Input value out of valid range, skipping update')
    return
  }

  // 检查值是否真正改变，避免不必要的更新
  const oldX = Math.round(point.x)
  const oldY = Math.round(point.y)
  const oldZ = Math.round(point.z)
  const x = Math.round(editableX.value)
  const y = Math.round(editableY.value)
  const z = Math.round(editableZ.value)

  if (x === oldX && y === oldY && z === oldZ) {
    // 值没有变化，不需要更新
    return
  }

  // 标记忽略下一次更新，避免watch覆盖用户的输入
  ignoreNextUpdate.value = true

  // 使用 requestAnimationFrame 确保UI更新后再执行store更新
  requestAnimationFrame(() => {
    store.updatePointPosition(point.id, x, y, z)
  })
}
</script>

<style scoped>
.detail-section:not(:first-child) {
  border-top: 1px solid var(--glass-border);
}

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

.coordinate-input {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--glass-border);
  padding: 8px;
  border-radius: var(--radius-xs);
  font-size: 13px;
  color: var(--text-primary);
  font-family: var(--font-family-mono);
  width: 100%;
  transition: all var(--transition-base);
  /* 禁用上下箭头按钮 */
  -moz-appearance: textfield;
  appearance: textfield;
  /* 确保计算期间继承 body 的光标 */
  cursor: inherit;
}

/* 禁用Webkit浏览器的上下箭头按钮 */
.coordinate-input::-webkit-outer-spin-button,
.coordinate-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.coordinate-input:focus {
  outline: none;
  border-color: var(--accent-blue);
  background: rgba(255, 255, 255, 0.08);
}

.coordinate-input:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: var(--glass-border-hover);
}

.coordinate-input.invalid {
  border-color: var(--accent-red);
  animation: shake 0.3s ease-in-out;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}

.error-text {
  font-size: 10px;
  color: var(--accent-red);
  margin-top: 4px;
  font-family: var(--font-family-mono);
}






</style>

