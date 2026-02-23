<template>
  <div class="panel-header">
    <div class="control-row">
      <div class="control-buttons">
        <button
          class="control-btn"
          :title="showPlayIcon ? 'Play' : 'Pause'"
          :aria-label="showPlayIcon ? 'Play' : 'Pause'"
          :disabled="disabled"
          @click="showPlayIcon ? $emit('play') : $emit('pause')"
        >
          <svg v-if="showPlayIcon" width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M4 2L15 9L4 16V2Z" fill="currentColor"/>
          </svg>
          <svg v-else width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <rect x="4" y="3" width="4" height="12" fill="currentColor"/>
            <rect x="10" y="3" width="4" height="12" fill="currentColor"/>
          </svg>
        </button>
        <button class="control-btn" @click="$emit('stop')" :disabled="disabled" title="Stop" aria-label="Stop">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <rect x="4" y="4" width="10" height="10" fill="currentColor"/>
          </svg>
        </button>
      </div>
      <span v-if="isInPlaybackMode" class="status-label">
        {{ isPaused ? 'Paused' : 'Playing' }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  disabled?: boolean
  /** 是否处于播放模式（已点击过 Play） */
  isInPlaybackMode?: boolean
  /** 是否暂停中（true=暂停，false=正在播放） */
  isPaused?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isInPlaybackMode: false,
  isPaused: true,
})

const showPlayIcon = computed(() => !props.isInPlaybackMode || props.isPaused)

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

.control-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.control-buttons {
  display: flex;
  gap: 40px;
  align-items: center;
}

.status-label {
  font-size: 13px;
  font-weight: var(--font-weight-medium);
  color: rgba(255, 255, 255, 0.7);
}

.control-row .status-label {
  padding-left: 8px;
  border-left: 1px solid rgba(255, 255, 255, 0.2);
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

