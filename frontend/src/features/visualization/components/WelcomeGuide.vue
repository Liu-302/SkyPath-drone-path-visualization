<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="visible" class="welcome-overlay" @click.self="dismiss">
        <div class="welcome-card">
          <h2 class="welcome-title">Welcome to SkyPath</h2>
          <p class="welcome-subtitle">Your data is loaded. Here's how to get started:</p>
          <div class="welcome-tips">
            <div class="tip-row">
              <span class="tip-label">Left drag</span>
              <span class="tip-desc">Rotate the 3D view</span>
            </div>
            <div class="tip-row">
              <span class="tip-label">Ctrl + Left drag</span>
              <span class="tip-desc">Pan the view</span>
            </div>
            <div class="tip-row">
              <span class="tip-label">Scroll wheel</span>
              <span class="tip-desc">Zoom in / out</span>
            </div>
            <div class="tip-row">
              <span class="tip-label">Click waypoint</span>
              <span class="tip-desc">Select & view coverage details</span>
            </div>
          </div>
          <button class="welcome-btn" @click="dismiss">Got it</button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  dismiss: []
}>()

function dismiss() {
  emit('dismiss')
}
</script>

<style scoped>
.welcome-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10002;
}

.welcome-card {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: 32px 40px;
  max-width: 420px;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.4);
}

.welcome-title {
  font-size: 22px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
  margin: 0 0 8px 0;
}

.welcome-subtitle {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  margin: 0 0 24px 0;
}

.welcome-tips {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 28px;
}

.tip-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.tip-label {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  flex-shrink: 0;
}

.tip-desc {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.65);
  text-align: right;
}

.welcome-btn {
  width: 100%;
  padding: 12px 24px;
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.1));
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
}

.welcome-btn:hover {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.25), rgba(255, 255, 255, 0.15));
  border-color: rgba(255, 255, 255, 0.35);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
