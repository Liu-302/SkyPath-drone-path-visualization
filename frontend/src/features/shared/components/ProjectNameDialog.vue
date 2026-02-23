<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="visible" class="dialog-overlay" @click.self="handleCancel">
        <div class="dialog">
          <h3 class="dialog-title">{{ title }}</h3>
          <p class="dialog-desc">Enter project name or use the default</p>
          <input
            ref="inputRef"
            v-model="localName"
            type="text"
            class="name-input"
            placeholder="Project name"
            maxlength="100"
            @keydown.enter="handleConfirm"
          />
          <div class="dialog-actions">
            <button class="btn cancel-btn" @click="handleCancel">Cancel</button>
            <button class="btn confirm-btn" @click="handleConfirm">{{ confirmLabel }}</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

interface Props {
  visible: boolean
  defaultName: string
  title?: string
  confirmLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: 'New Project',
  confirmLabel: 'Create',
})

interface Emits {
  (e: 'confirm', name: string): void
  (e: 'cancel'): void
  (e: 'update:visible', value: boolean): void
}

const emit = defineEmits<Emits>()
const inputRef = ref<HTMLInputElement | null>(null)
const localName = ref('')

watch(
  () => [props.visible, props.defaultName] as const,
  ([visible, defaultName]) => {
    if (visible) {
      localName.value = defaultName
      setTimeout(() => inputRef.value?.focus(), 50)
    }
  },
  { immediate: true }
)

function handleConfirm() {
  const name = localName.value.trim() || props.defaultName
  emit('confirm', name)
  emit('update:visible', false)
}

function handleCancel() {
  emit('cancel')
  emit('update:visible', false)
}
</script>

<style scoped>
.dialog-overlay {
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

.dialog {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: 28px 32px;
  min-width: 400px;
  max-width: 480px;
  box-shadow: var(--shadow-deep);
  position: relative;
  overflow: hidden;
}

.dialog::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--gradient-accent);
  opacity: 0.5;
}

.dialog-title {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.dialog-desc {
  margin: 0 0 16px 0;
  font-size: 13px;
  color: var(--text-tertiary);
}

.name-input {
  width: 100%;
  padding: 12px 16px;
  margin-bottom: 24px;
  font-size: 15px;
  color: var(--text-primary);
  background: var(--glass-bg-hover);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.name-input:focus {
  border-color: var(--accent-white);
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.15);
}

.name-input::placeholder {
  color: var(--text-tertiary);
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.btn {
  padding: 10px 24px;
  border-radius: var(--radius-full);
  border: none;
  cursor: pointer;
  font-size: 13px;
  font-weight: var(--font-weight-semibold);
  transition: all var(--transition-base);
}

.cancel-btn {
  background: transparent;
  border: 1px solid var(--glass-border);
  color: var(--text-primary);
}

.cancel-btn:hover {
  background: var(--glass-bg-hover);
  border-color: var(--accent-white);
}

.confirm-btn {
  background: var(--accent-white);
  color: var(--bg-primary);
  box-shadow: var(--shadow-float);
}

.confirm-btn:hover {
  box-shadow: var(--glow-white-strong);
  transform: translateY(-1px);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-enter-active .dialog,
.fade-leave-active .dialog {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.fade-enter-from .dialog {
  transform: scale(0.9) translateY(-20px);
  opacity: 0;
}

.fade-leave-to .dialog {
  transform: scale(0.95);
  opacity: 0;
}
</style>
