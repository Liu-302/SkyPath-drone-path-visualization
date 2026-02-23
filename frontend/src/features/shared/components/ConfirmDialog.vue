<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="visible" class="confirm-dialog-overlay" @click.self="handleCancel">
        <div class="confirm-dialog">
          <div class="confirm-dialog-content">
            <p class="confirm-message">{{ message }}</p>
          </div>
          <div class="confirm-dialog-actions">
            <button v-if="showCancel" class="confirm-btn cancel-btn" @click="handleCancel">
              {{ cancelLabel }}
            </button>
            <button class="confirm-btn confirm-btn-primary" @click="handleConfirm">
              {{ confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">

interface Props {
  visible: boolean
  message: string
  /** When false, only show OK button (alert mode) */
  showCancel?: boolean
  /** Label for the cancel button */
  cancelLabel?: string
  /** Label for the primary button */
  confirmLabel?: string
}

withDefaults(defineProps<Props>(), {
  showCancel: true,
  cancelLabel: 'Cancel',
  confirmLabel: 'Confirm'
})

interface Emits {
  (e: 'confirm'): void
  (e: 'cancel'): void
  (e: 'update:visible', value: boolean): void
}

const emit = defineEmits<Emits>()

function handleConfirm() {
  emit('confirm')
  emit('update:visible', false)
}

function handleCancel() {
  emit('cancel')
  emit('update:visible', false)
}
</script>

<style scoped>
.confirm-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.confirm-dialog {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: 36px 32px;
  min-width: 440px;
  max-width: 520px;
  box-shadow: var(--shadow-deep);
  position: relative;
  overflow: hidden;
}

.confirm-dialog::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--gradient-accent);
  opacity: 0.5;
}

.confirm-dialog-content {
  margin-bottom: 28px;
  text-align: center;
}

.confirm-message {
  color: var(--text-primary);
  font-size: 15px;
  font-weight: var(--font-weight-regular);
  line-height: 1.7;
  margin: 0;
  white-space: pre-line;
  letter-spacing: var(--letter-spacing-normal);
}

.confirm-dialog-actions {
  display: flex;
  justify-content: center;
  gap: 16px;
}

.confirm-btn {
  padding: 12px 28px;
  border-radius: var(--radius-full);
  border: none;
  cursor: pointer;
  font-size: 13px;
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--letter-spacing-wide);
  text-transform: uppercase;
  transition: all var(--transition-base);
  position: relative;
  overflow: hidden;
  min-width: 120px;
}

.confirm-btn::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  transform: translate(-50%, -50%);
  transition: width 0.5s ease, height 0.5s ease;
}

.confirm-btn:hover::before {
  width: 300px;
  height: 300px;
}

.cancel-btn {
  background: transparent;
  border: 1px solid var(--glass-border);
  color: var(--text-primary);
}

.cancel-btn:hover {
  background: var(--glass-bg-hover);
  border-color: var(--accent-white);
  box-shadow: var(--glow-white);
}

.confirm-btn-primary {
  background: var(--accent-white);
  color: var(--bg-primary);
  box-shadow: var(--shadow-float);
}

.confirm-btn-primary:hover {
  box-shadow: var(--glow-white-strong);
  transform: translateY(-2px);
}

/* 过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-enter-active .confirm-dialog,
.fade-leave-active .confirm-dialog {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.fade-enter-from .confirm-dialog {
  transform: scale(0.9) translateY(-20px);
  opacity: 0;
}

.fade-leave-to .confirm-dialog {
  transform: scale(0.95);
  opacity: 0;
}
</style>

