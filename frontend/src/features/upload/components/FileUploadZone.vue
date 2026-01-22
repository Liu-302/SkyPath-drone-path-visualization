<template>
  <div class="dropzone-container">
    <div
      class="dropzone"
      :class="{ 'is-drag': isDrag }"
      @dragenter.prevent="handleDragEnter"
      @dragover.prevent="handleDragOver"
      @dragleave.prevent="handleDragLeave"
      @drop.prevent="handleDrop"
    >
      <input
        ref="fileInput"
        type="file"
        :accept="accept"
        @change="handleFileSelect"
        style="display: none;"
      />
      <div class="upload-area" @click="handleClick">
        <div class="dz-icon">⬆</div>
        <div>{{ placeholder }}</div>
      </div>
    </div>
    
    <!-- 文件显示区域 -->
    <div v-if="files.length > 0" class="uploaded-files">
      <div class="files-grid">
        <div v-for="f in files" :key="f.name" class="file-item">
          <span class="file-name">{{ f.name }}</span>
          <button
            class="delete-btn"
            @click="handleRemove(f.name)"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  accept: string
  placeholder: string
  files: File[]
  isDrag?: boolean
}

interface Emits {
  (e: 'select', files: FileList | null): void
  (e: 'drop', event: DragEvent): void
  (e: 'remove', fileName: string): void
  (e: 'update:isDrag', value: boolean): void
}

const props = withDefaults(defineProps<Props>(), {
  isDrag: false
})

const emit = defineEmits<Emits>()

const fileInput = ref<HTMLInputElement | null>(null)

const handleClick = () => {
  fileInput.value?.click()
}

const handleFileSelect = (e: Event) => {
  const target = e.target as HTMLInputElement
  emit('select', target.files)
  // 清空 input,确保可以重复选择相同文件
  target.value = ''
}

const handleDragEnter = () => {
  emit('update:isDrag', true)
}

const handleDragOver = () => {
  emit('update:isDrag', true)
}

const handleDragLeave = () => {
  emit('update:isDrag', false)
}

const handleDrop = (e: DragEvent) => {
  emit('drop', e)
  emit('update:isDrag', false)
}

const handleRemove = (fileName: string) => {
  emit('remove', fileName)
}
</script>

<style scoped>
.dropzone-container {
  display: grid;
  gap: 16px;
}

.dropzone {
  position: relative;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  padding: 0;
  cursor: default;
}

.dropzone input {
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
}

.upload-area {
  border: 2px dashed var(--glass-border);
  border-radius: var(--radius-md);
  padding: 48px 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--transition-base);
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  min-height: 140px;
  position: relative;
  overflow: hidden;
  color: var(--text-secondary);
}

.upload-area::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.03) 0%, transparent 70%);
  transform: translate(-50%, -50%);
  transition: opacity var(--transition-base);
  opacity: 0;
}

.upload-area:hover {
  border-color: rgba(255, 255, 255, 0.4);
  background: var(--glass-bg-hover);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  transform: translateY(-2px);
  color: var(--text-primary);
}

.upload-area:hover::before {
  opacity: 1;
}

.dropzone.is-drag .upload-area {
  border-color: var(--accent-white);
  background: var(--glass-bg-active);
  box-shadow: var(--glow-white-strong);
  transform: scale(0.98);
}

.dz-icon {
  width: 48px;
  height: 48px;
  margin: 0 auto 16px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gradient-accent);
  color: var(--accent-white);
  font-size: 24px;
  box-shadow: var(--shadow-float);
}

.uploaded-files {
  text-align: left;
  animation: slideUp 0.4s ease-out;
}

.files-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  max-height: 80px;
  overflow-y: auto;
  padding-right: 4px;
}

.file-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  min-height: 36px;
  transition: all var(--transition-base);
  cursor: default;
  pointer-events: none;
}

.file-item:hover {
  background: var(--glass-bg-hover);
  border-color: var(--glass-border-hover);
  transform: translateY(-1px);
}

.file-name {
  color: var(--text-primary);
  font-size: 13px;
  font-weight: var(--font-weight-medium);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 12px;
}

.delete-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
  border-radius: var(--radius-xs);
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 16px;
  font-weight: bold;
  transition: all var(--transition-base);
  pointer-events: auto;
  flex-shrink: 0;
}

.delete-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: var(--accent-white);
  transform: scale(1.1);
  box-shadow: var(--glow-white);
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>

