<template>
  <div class="panel-header">
    <div class="control-buttons">
      <button class="control-btn" @click="$emit('play')" :disabled="disabled">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M4 2L15 9L4 16V2Z" fill="currentColor"/>
        </svg>
      </button>
      <button class="control-btn" @click="$emit('pause')" :disabled="disabled">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <rect x="4" y="3" width="4" height="12" fill="currentColor"/>
          <rect x="10" y="3" width="4" height="12" fill="currentColor"/>
        </svg>
      </button>
      <button class="control-btn" @click="$emit('stop')" :disabled="disabled">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <rect x="4" y="4" width="10" height="10" fill="currentColor"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  disabled?: boolean
}

defineProps<Props>()

defineEmits<{
  play: []
  pause: []
  stop: []
}>()
</script>

<style scoped>
.panel-header {
  padding: 12px 24px;
  border-bottom: 1px solid var(--glass-border);
  display: flex;
  justify-content: center;
  align-items: center;
  flex-shrink: 0;
  background: var(--gradient-cold-1);
}

.control-buttons {
  display: flex;
  gap: 40px;
  align-items: center;
}

.control-btn {
  width: 40px;
  height: 40px;
  border: 1.5px solid rgba(255, 255, 255, 0.35);
  background: transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-base);
  color: var(--text-secondary);
  position: relative;
  padding: 0;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.1);
}

.control-btn svg {
  transition: all var(--transition-fast);
}

.control-btn:hover:not(:disabled) {
  background: var(--glass-bg-hover);
  border-color: rgba(255, 255, 255, 0.5);
  color: var(--text-primary);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.2);
}

.control-btn:hover:not(:disabled) svg {
  transform: scale(1.1);
}

.control-btn:active:not(:disabled) {
  background: var(--glass-bg-active);
  transform: scale(0.95);
}

.control-btn:disabled {
  opacity: 0.25;
  cursor: not-allowed;
  border-color: rgba(255, 255, 255, 0.15);
}
</style>

