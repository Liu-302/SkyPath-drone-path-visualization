<template>
  <div class="page-wrap">
    <!-- 粒子背景 -->
    <ParticleBackground />
    
    <div class="center-container">
      <div class="panel">
        <header class="panel-header">
          <h1>Upload Files</h1>
        </header>

        <!-- ================= 模型上传区 ================= -->
        <section class="section">
          <div class="section-title-wrapper">
          <h2>3D Model(OBJ)</h2>
            <p class="upload-hint">Only one file can be uploaded</p>
          </div>

          <FileUploadZone
            accept=".obj"
            placeholder="Drag or click to select model file"
            :files="models"
            v-model:is-drag="isModelDrag"
            @select="handleModelFileSelect"
            @drop="handleModelFileDrop"
            @remove="removeModel"
          />
        </section>

        <!-- ================= 路径上传区 ================= -->
        <section class="section">
          <div class="section-title-wrapper">
          <h2>Flight Path(JSON)</h2>
            <p class="upload-hint">Only one file can be uploaded</p>
          </div>

          <FileUploadZone
            accept=".json"
            placeholder="Drag or click to select path file"
            :files="paths"
            v-model:is-drag="isPathDrag"
            @select="handlePathFileSelect"
            @drop="handlePathFileDrop"
            @remove="removePath"
          />
        </section>


        <!-- ================= 操作区 ================= -->
        <footer class="footer">
          <div style="flex: 1;"></div>
          <div style="display: flex; gap: 12px;">
            <button class="btn" @click="resetAll">Reset All</button>
            <button class="btn primary" :disabled="!canVisualize" @click="goVisualize">
              Start Visualization
            </button>
          </div>
        </footer>

        <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
        <p v-if="okMsg" class="ok">{{ okMsg }}</p>
      </div>
    </div>
    
    <!-- 确认对话框 -->
    <ConfirmDialog
      v-model:visible="dialogVisible"
      :message="dialogMessage"
      @confirm="handleDialogConfirm"
      @cancel="handleDialogCancel"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from '@fesjs/fes'
import { useDatasetStore } from '@/stores/dataset'
import ConfirmDialog from '@/features/shared/components/ConfirmDialog.vue'
import ParticleBackground from '@/features/upload/components/ParticleBackground.vue'
import FileUploadZone from '@/features/upload/components/FileUploadZone.vue'
import { useConfirmDialog } from '@/features/shared/composables/useConfirmDialog'
import { useFileUpload } from '@/features/upload/composables/useFileUpload'
import { usePathParser } from '@/features/visualization/services/path-parser.service'

const router = useRouter()
const store = useDatasetStore()

const { dialogVisible, dialogMessage, showConfirmDialog, handleConfirm: handleDialogConfirm, handleCancel: handleDialogCancel } = useConfirmDialog()
const { parsePathFile } = usePathParser()

// computed
const models = computed(() => store.modelFiles)
const paths = computed(() => store.pathFiles)
const hasObjFile = computed(() => store.modelFiles.some(f => f.name.toLowerCase().endsWith('.obj')))
const canVisualize = computed(() => hasObjFile.value && store.pathFiles.length > 0)

// ====================== 上传逻辑 ======================
const modelUpload = useFileUpload(
  /\.obj$/i,
  'model',
  (currentFile, newFile) =>
    showConfirmDialog(`Model file \"${currentFile}\" already exists.\nDo you want to replace it with \"${newFile}\"?`)
)

const {
  isDrag: isModelDrag,
  handleFileSelect: handleModelFileSelect,
  handleFileDrop: handleModelFileDrop,
  removeFile: removeModel,
  errorMsg: modelError,
  okMsg: modelOk
} = modelUpload

const pathUpload = useFileUpload(
  /\.json$/i,
  'path',
  (currentFile, newFile) =>
    showConfirmDialog(`Path file \"${currentFile}\" already exists.\nDo you want to replace it with \"${newFile}\"?`),
  {
    onAfterAdd: parsePathFile
  }
)

const {
  isDrag: isPathDrag,
  handleFileSelect: handlePathFileSelect,
  handleFileDrop: handlePathFileDrop,
  removeFile: removePath,
  errorMsg: pathError,
  okMsg: pathOk
} = pathUpload

const errorMsg = computed(() => modelError.value || pathError.value)
const okMsg = computed(() => modelOk.value || pathOk.value)

// ====================== 操作区 ======================
function resetAll() {
  console.log(`[操作] 重置所有文件与状态`)
  store.resetAll()
  modelUpload.clearMessages()
  pathUpload.clearMessages()
}

function goVisualize() {
  console.log(`[操作] 进入可视化页面`)
  router.push('/visualize')
}
</script>

<style scoped>
.page-wrap {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: #000000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 60px 20px;
  overflow-y: auto;
  z-index: 1;
}

.center-container { 
  width: 100%; 
  max-width: 100%;
  display: flex; 
  justify-content: center; 
  position: relative;
  z-index: 2;
  min-height: min-content;
}

.panel {
  width: min(720px, 90vw);
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-deep), 0 0 30px rgba(255, 255, 255, 0.05);
  color: var(--text-primary);
  padding: 48px 40px;
  display: grid; 
  gap: 32px;
  position: relative;
  margin: auto 0;
}

.panel::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--gradient-accent);
  opacity: 0.3;
}

.panel-header {
  text-align: center;
  position: relative;
  margin-bottom: -16px;
}

.panel-header h1 { 
  margin: 0; 
  font-size: 42px;
  font-weight: var(--font-weight-bold);
  background: linear-gradient(135deg, #ffffff 0%, #d4dce5 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  word-spacing: 0.2em;
}

.section { 
  display: grid; 
  gap: 16px;
}

.section-title-wrapper {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.section h2 { 
  font-size: 14px;
  margin: 0;
  font-weight: var(--font-weight-medium);
  letter-spacing: var(--letter-spacing-wide);
  text-transform: uppercase;
  color: var(--text-secondary);
}

.upload-hint {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  margin: 0;
  font-style: italic;
  letter-spacing: 0.02em;
}

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

.footer { 
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--glass-border);
}

.btn { 
  padding: 14px 32px;
  border-radius: var(--radius-sm);
  border: none;
  cursor: pointer;
  font-size: 13px;
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--letter-spacing-wide);
  text-transform: uppercase;
  transition: all var(--transition-base);
  position: relative;
  overflow: hidden;
}

.btn:not(.primary) { 
  background: transparent;
  border: 1px solid var(--glass-border-hover);
  color: rgba(255, 255, 255, 0.85);
}

.btn:not(.primary):hover {
  border-color: var(--accent-white);
  background: var(--glass-bg-hover);
  color: var(--text-primary);
}

.btn.primary { 
  background: var(--accent-white);
  color: var(--bg-primary);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.btn.primary:hover {
  background: rgba(255, 255, 255, 0.95);
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
}

.btn.primary:active {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.btn:disabled { 
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.05);
  color: var(--text-disabled);
  cursor: not-allowed;
  opacity: 0.4;
  transform: none !important;
  box-shadow: none !important;
}

.error { 
  color: #ff6b6b;
  font-size: 14px;
  text-align: center;
  padding: 12px;
  background: rgba(255, 107, 107, 0.1);
  border-radius: var(--radius-sm);
  animation: slideUp 0.3s ease-out;
}

.ok { 
  color: #51cf66;
  font-size: 14px;
  text-align: center;
  padding: 12px;
  background: rgba(81, 207, 102, 0.1);
  border-radius: var(--radius-sm);
  animation: slideUp 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
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
