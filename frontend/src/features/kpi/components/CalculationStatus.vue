<template>
  <div class="calculation-status" v-if="visible">
    <div class="error">
      <span class="error-message">{{ message }}</span>
      <button @click="$emit('retry')" class="retry-btn">重试</button>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  visible: boolean
  message: string
}

defineProps<Props>()

defineEmits<{
  retry: []
}>()
</script>

<style scoped>
.calculation-status {
  padding: 16px;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  margin: 24px;
  flex-shrink: 0;
}

.error {
  display: flex;
  align-items: center;
  gap: 12px;
}

.error-message {
  flex: 1;
  color: #ff6b6b;
  font-size: 13px;
}

.retry-btn {
  background: var(--accent-white);
  color: var(--bg-primary);
  border: none;
  padding: 6px 12px;
  border-radius: var(--radius-xs);
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-wide);
  cursor: pointer;
  transition: all var(--transition-base);
}

.retry-btn:hover {
  box-shadow: var(--glow-white);
  transform: translateY(-1px);
}
</style>
