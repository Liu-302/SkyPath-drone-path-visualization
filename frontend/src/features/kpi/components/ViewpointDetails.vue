<template>
  <div class="detail-section">
    <div class="section-header">Viewpoint & Camera Data</div>
    <div class="section-content">
      <div class="data-row">
        <span class="data-label">Camera Pitch / Yaw (°):</span>
        <div class="coordinate-fields">
          <div class="coordinate-field">
            <span class="coordinate-label">Pitch</span>
            <input
              v-model.number="editablePitch"
              type="text"
              inputmode="decimal"
              pattern="-?\d*\.?\d*"
              step="0.1"
              :class="['coordinate-input', { 'invalid': !isPitchValid }]"
              aria-label="Pitch angle in degrees (-90 to 90)"
              @blur="updateCameraAngle"
              @keydown.enter="($event.target as HTMLInputElement).blur()"
              @keydown="handleNumberInput"
              @wheel="handleWheel"
            />
            <span v-if="!isPitchValid" class="error-text">Invalid value, valid range: -90~90</span>
          </div>
          <div class="coordinate-field">
            <span class="coordinate-label">Yaw</span>
            <input
              v-model.number="editableYaw"
              type="text"
              inputmode="decimal"
              pattern="-?\d*\.?\d*"
              step="0.1"
              :class="['coordinate-input', { 'invalid': !isYawValid }]"
              aria-label="Yaw angle in degrees (0 to 360)"
              @blur="updateCameraAngle"
              @keydown.enter="($event.target as HTMLInputElement).blur()"
              @keydown="handleNumberInput"
              @wheel="handleWheel"
            />
            <span v-if="!isYawValid" class="error-text">Invalid value, valid range: 0~360</span>
          </div>
        </div>
      </div>
      <div class="data-row">
        <span class="data-label">Overlap with Previous Frame</span>
        <span class="data-value">
          <template v-if="overlapLoading">Loading...</template>
          <template v-else>{{ displayedOverlap !== null ? displayedOverlap.toFixed(1) : 'N/A' }} %</template>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import { Viewpoint } from '../types/kpi'
import { useDatasetStore } from '@/stores/dataset'
import { calculateNormalFromAngle } from '@/shared/utils/coordinate-converter'
import { BACKEND_CONFIG } from '@/shared/config/backend.config'

interface Props {
  viewpointData: Viewpoint
  viewpointIndex: number
}

const props = defineProps<Props>()
const store = useDatasetStore()

// 后端返回的 overlap（与整体KPI口径一致）
const backendOverlap = ref<number | null>(null)
const overlapLoading = ref(false)

const displayedOverlap = computed(() => {
  // 优先使用后端结果；后端不可用/未返回时回退到 props（兼容旧逻辑）
  if (backendOverlap.value !== null) return backendOverlap.value
  return props.viewpointData.overlap
})

// 可编辑的相机角度值
const editablePitch = ref(0)
const editableYaw = ref(0)

// 是否忽略下一次props更新（防止watch覆盖用户输入）
const ignoreNextUpdate = ref(false)

// 验证状态
const isPitchValid = computed(() => {
  return Number.isFinite(editablePitch.value) && editablePitch.value >= -90 && editablePitch.value <= 90
})

const isYawValid = computed(() => {
  return Number.isFinite(editableYaw.value) && editableYaw.value >= 0 && editableYaw.value <= 360
})

// 初始化编辑值
onMounted(() => {
  editablePitch.value = Number(props.viewpointData.pitch)
  editableYaw.value = Number(props.viewpointData.yaw)
})

async function fetchBackendViewpointOverlap() {
  // index 0 没有上一帧，直接显示 N/A
  if (props.viewpointIndex === 0) {
    backendOverlap.value = null
    overlapLoading.value = false
    return
  }

  overlapLoading.value = true
  // 准备 pathPoints（与 Visualize.vue /kpi 一致）
  const pathPoints = store.parsedPoints.map((point) => {
    let normal = { x: 0, y: -1, z: 0 }
    if (point.normal && typeof point.normal === 'object') {
      const normalVec = {
        x: point.normal.x ?? 0,
        y: point.normal.y ?? 0,
        z: point.normal.z ?? 0,
      }
      const normalLength = Math.sqrt(normalVec.x * normalVec.x + normalVec.y * normalVec.y + normalVec.z * normalVec.z)
      if (normalLength > 0.001) {
        normal = {
          x: normalVec.x / normalLength,
          y: normalVec.y / normalLength,
          z: normalVec.z / normalLength,
        }
      }
    }
    return {
      x: point.x,
      y: point.y,
      z: point.z,
      normalX: normal.x,
      normalY: normal.y,
      normalZ: normal.z,
    }
  })

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), BACKEND_CONFIG.TIMEOUT)

  try {
    const response = await fetch(`${BACKEND_CONFIG.BASE_URL}/api/projects/${BACKEND_CONFIG.DEFAULT_PROJECT_ID}/viewpoint-metrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        index: props.viewpointIndex,
        pathPoints,
        // buildingMesh 省略，依赖后端缓存/数据库（与 /kpi 一致）
        buildingMesh: null,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      backendOverlap.value = null
      return
    }

    const result = await response.json()
    // 后端字段名：overlapWithPrevious
    const overlap = result?.overlapWithPrevious
    backendOverlap.value = typeof overlap === 'number' ? overlap : null
  } catch {
    backendOverlap.value = null
  } finally {
    clearTimeout(timeoutId)
    overlapLoading.value = false
  }
}

// 选中航点切换时，拉取后端 overlap
watch(
  () => props.viewpointIndex,
  () => {
    fetchBackendViewpointOverlap()
  },
  { immediate: true }
)

// 监听 props 的 pitch/yaw 数值变化并同步到输入框（撤销/重做后能正确刷新）
watch(
  () => [Number(props.viewpointData.pitch), Number(props.viewpointData.yaw)] as [number, number],
  ([newPitch, newYaw]) => {
    if (ignoreNextUpdate.value) {
      ignoreNextUpdate.value = false
      // 若新值与当前一致，说明是本次提交触发的更新，已跳过；否则为撤销/重做，必须同步
      if (newPitch === editablePitch.value && newYaw === editableYaw.value) return
    }
    editablePitch.value = newPitch
    editableYaw.value = newYaw
  }
)

// 处理wheel事件，在输入框聚焦时阻止默认滚动行为
const handleWheel = (event: WheelEvent) => {
  const target = event.target as HTMLInputElement
  if (target === document.activeElement) {
    event.preventDefault()
  }
}

// 处理数字输入，只允许数字、负号、小数点和导航键
const handleNumberInput = (event: KeyboardEvent) => {
  const key = event.key

  // 允许的特殊键：退格、删除、左右箭头、Tab、Enter、负号、小数点
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

  // 允许小数点（只能有一个）
  if (key === '.') {
    const input = event.target as HTMLInputElement
    if (!input.value.includes('.')) {
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

// 更新相机角度到store
const updateCameraAngle = () => {
  const point = store.parsedPoints[props.viewpointIndex]
  if (!point) return

  // 验证输入值
  if (!isPitchValid.value || !isYawValid.value) {
    console.warn('Camera angle out of valid range, skipping update')
    return
  }

  // 限制精度：保留1位小数
  const pitch = Math.round(editablePitch.value * 10) / 10
  const yaw = Math.round(editableYaw.value * 10) / 10
  // Roll 固定为 0（默认水平状态）
  const roll = 0

  // 标记忽略下一次更新，避免watch覆盖用户的输入
  ignoreNextUpdate.value = true

  const normal = calculateNormalFromAngle(pitch, yaw, roll)
  store.updatePointNormal(point.id, normal)

  // normal 变化后同步刷新后端 overlap（避免与整体KPI口径不一致）
  fetchBackendViewpointOverlap()
}
</script>

<style scoped>
.detail-section {
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

