<template>
  <TresGroup v-if="visible && position" ref="groupRef" :position="position">
    <!-- X轴 - 红色 -->
    <TresMesh
      ref="xAxisRef"
      :position="[axisLength / 2, 0, 0]"
      :rotation="[0, 0, -Math.PI / 2]"
      @click.stop="handleAxisClick('x', $event)"
      @pointer-down.stop="handleAxisClick('x', $event)"
      @pointer-enter="handleAxisHover('x', true)"
      @pointer-leave="handleAxisHover('x', false)"
    >
      <TresCylinderGeometry :args="[axisRadius, axisRadius, axisLength]" />
      <TresMeshBasicMaterial :color="hoveredAxis === 'x' ? 0xffff00 : 0xff0000" />
    </TresMesh>
    
    <!-- X轴箭头 -->
    <TresMesh
      ref="xArrowRef"
      :position="[axisLength, 0, 0]"
      :rotation="[0, 0, -Math.PI / 2]"
      @click.stop="handleAxisClick('x', $event)"
      @pointer-down.stop="handleAxisClick('x', $event)"
      @pointer-enter="handleAxisHover('x', true)"
      @pointer-leave="handleAxisHover('x', false)"
    >
      <TresConeGeometry :args="[arrowSize, arrowSize * 2, 8]" />
      <TresMeshBasicMaterial :color="hoveredAxis === 'x' ? 0xffff00 : 0xff0000" />
    </TresMesh>

    <!-- Y轴 - 绿色 -->
    <TresMesh
      ref="yAxisRef"
      :position="[0, axisLength / 2, 0]"
      @click.stop="handleAxisClick('y', $event)"
      @pointer-down.stop="handleAxisClick('y', $event)"
      @pointer-enter="handleAxisHover('y', true)"
      @pointer-leave="handleAxisHover('y', false)"
    >
      <TresCylinderGeometry :args="[axisRadius, axisRadius, axisLength]" />
      <TresMeshBasicMaterial :color="hoveredAxis === 'y' ? 0xffff00 : 0x00ff00" />
    </TresMesh>
    
    <!-- Y轴箭头 -->
    <TresMesh
      ref="yArrowRef"
      :position="[0, axisLength, 0]"
      @click.stop="handleAxisClick('y', $event)"
      @pointer-down.stop="handleAxisClick('y', $event)"
      @pointer-enter="handleAxisHover('y', true)"
      @pointer-leave="handleAxisHover('y', false)"
    >
      <TresConeGeometry :args="[arrowSize, arrowSize * 2, 8]" />
      <TresMeshBasicMaterial :color="hoveredAxis === 'y' ? 0xffff00 : 0x00ff00" />
    </TresMesh>

    <!-- Z轴 - 蓝色（指向负Z方向，与全局坐标系统一） -->
    <TresMesh
      ref="zAxisRef"
      :position="[0, 0, -axisLength / 2]"
      :rotation="[Math.PI / 2, 0, 0]"
      @click.stop="handleAxisClick('z', $event)"
      @pointer-down.stop="handleAxisClick('z', $event)"
      @pointer-enter="handleAxisHover('z', true)"
      @pointer-leave="handleAxisHover('z', false)"
    >
      <TresCylinderGeometry :args="[axisRadius, axisRadius, axisLength]" />
      <TresMeshBasicMaterial :color="hoveredAxis === 'z' ? 0xffff00 : 0x0000ff" />
    </TresMesh>
    
    <!-- Z轴箭头 -->
    <TresMesh
      ref="zArrowRef"
      :position="[0, 0, -axisLength]"
      :rotation="[Math.PI / 2, 0, 0]"
      @click.stop="handleAxisClick('z', $event)"
      @pointer-down.stop="handleAxisClick('z', $event)"
      @pointer-enter="handleAxisHover('z', true)"
      @pointer-leave="handleAxisHover('z', false)"
    >
      <TresConeGeometry :args="[arrowSize, arrowSize * 2, 8]" />
      <TresMeshBasicMaterial :color="hoveredAxis === 'z' ? 0xffff00 : 0x0000ff" />
    </TresMesh>
  </TresGroup>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'

interface Props {
  visible?: boolean
  position?: [number, number, number]
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  position: undefined,
})

const emit = defineEmits<{
  axisClick: [axis: 'x' | 'y' | 'z']
  axisHover: [axis: 'x' | 'y' | 'z' | null]
}>()

const hoveredAxis = ref<'x' | 'y' | 'z' | null>(null)

const axisLength = 8 // 减小轴长度
const axisRadius = 0.2 // 减小轴半径
const arrowSize = 0.5 // 减小箭头大小

// 存储轴的引用
const xAxisRef = ref()
const xArrowRef = ref()
const yAxisRef = ref()
const yArrowRef = ref()
const zAxisRef = ref()
const zArrowRef = ref()
const groupRef = ref() // Group的引用

// 设置 userData 以便射线检测
onMounted(() => {
  nextTick(() => {
    if (xAxisRef.value?.value) {
      xAxisRef.value.value.userData = { axis: 'x' }
    }
    if (xArrowRef.value?.value) {
      xArrowRef.value.value.userData = { axis: 'x' }
    }
    if (yAxisRef.value?.value) {
      yAxisRef.value.value.userData = { axis: 'y' }
    }
    if (yArrowRef.value?.value) {
      yArrowRef.value.value.userData = { axis: 'y' }
    }
    if (zAxisRef.value?.value) {
      zAxisRef.value.value.userData = { axis: 'z' }
    }
    if (zArrowRef.value?.value) {
      zArrowRef.value.value.userData = { axis: 'z' }
    }
  })
})

function handleAxisClick(axis: 'x' | 'y' | 'z', event?: any) {
  // 阻止事件冒泡，防止触发相机控制
  if (event) {
    if (typeof event.preventDefault === 'function') {
      event.preventDefault()
    }
    if (typeof event.stopPropagation === 'function') {
      event.stopPropagation()
    }
    if (typeof event.stopImmediatePropagation === 'function') {
      event.stopImmediatePropagation()
    }
  }
  emit('axisClick', axis)
}

function handleAxisHover(axis: 'x' | 'y' | 'z', isEntering: boolean) {
  hoveredAxis.value = isEntering ? axis : null
  emit('axisHover', hoveredAxis.value)
}

// 暴露group对象供父组件使用
defineExpose({
  group: groupRef
})
</script>
