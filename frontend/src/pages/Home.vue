<template>
  <div class="page-wrap">
    <ParticleBackground />
    <div class="center-container">
      <div class="panel">
        <header class="panel-header">
          <div class="header-row">
            <div class="brand">
              <img src="/SkyPath_logo.png" alt="" class="brand-logo" />
              <h1>SkyPath</h1>
            </div>
            <div class="user-area">
              <span v-if="authStore.user" class="user-name">{{ authStore.user.username }}</span>
              <button class="btn-text" @click="handleLogout">Logout</button>
            </div>
          </div>
          <p class="subtitle">Open an existing project or create a new one</p>
        </header>

        <section class="section">
          <h2 class="section-title">My Projects</h2>
          <div class="project-list-scroll">
            <div v-if="loading" class="loading-hint">Loading...</div>
            <div v-else-if="errorMsg" class="error">{{ errorMsg }}</div>
            <div v-else-if="projects.length === 0" class="empty-hint">
              No projects yet. Click "New Project" below to upload a model and get started.
            </div>
            <ul v-else class="project-list">
              <li
                v-for="proj in projects"
                :key="proj.id"
                class="project-item"
                @click="openProject(proj.id)"
                @contextmenu.prevent="(e) => showContextMenu(e, proj)"
              >
                <span class="project-name">{{ proj.name || 'Untitled' }}</span>
                <div class="project-more-wrap" @click.stop>
                  <button
                    type="button"
                    class="more-btn"
                    title="More options"
                    @click="toggleDropdown(proj.id)"
                    aria-haspopup="true"
                    :aria-expanded="openDropdownId === proj.id"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                      <circle cx="8" cy="3" r="1.5" />
                      <circle cx="8" cy="8" r="1.5" />
                      <circle cx="8" cy="13" r="1.5" />
                    </svg>
                  </button>
                  <Transition name="dropdown">
                    <div
                      v-if="openDropdownId === proj.id"
                      class="dropdown-menu"
                      @click.stop
                    >
                      <button type="button" class="dropdown-item" @click="onDropdownRename(proj)">
                        Rename
                      </button>
                      <button type="button" class="dropdown-item" @click="onDropdownDelete(proj)">
                        Delete
                      </button>
                    </div>
                  </Transition>
                </div>
              </li>
            </ul>
          </div>

          <!-- Right-click context menu -->
          <Teleport to="body">
            <Transition name="dropdown">
              <div
                v-if="contextMenuProject"
                class="context-menu"
                :style="{ left: contextMenuX + 'px', top: contextMenuY + 'px' }"
              >
                <button type="button" class="dropdown-item" @click="onContextRename">Rename</button>
                <button type="button" class="dropdown-item" @click="onContextDelete">Delete</button>
              </div>
            </Transition>
          </Teleport>
        </section>

        <footer class="footer">
          <button class="btn primary full" @click="openNewProjectDialog">
            New Project
          </button>
        </footer>
      </div>
    </div>

    <ProjectNameDialog
      v-model:visible="showNewProjectDialog"
      :default-name="newProjectDefaultName"
      @confirm="onNewProjectConfirm"
    />

    <ProjectNameDialog
      v-model:visible="showRenameDialog"
      :default-name="renameProjectName"
      title="Rename Project"
      confirm-label="Save"
      @confirm="onRenameConfirm"
    />

    <ConfirmDialog
      v-model:visible="showDeleteConfirm"
      :message="deleteConfirmMessage"
      confirm-label="Delete"
      @confirm="onDeleteConfirm"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from '@fesjs/fes'
import { useAuthStore } from '@/stores/auth'
import { useDatasetStore } from '@/stores/dataset'
import { getProjects, createProject, deleteProject, updateProjectName } from '@/shared/services/projectDataService'
import ParticleBackground from '@/features/upload/components/ParticleBackground.vue'
import ProjectNameDialog from '@/features/shared/components/ProjectNameDialog.vue'
import ConfirmDialog from '@/features/shared/components/ConfirmDialog.vue'

const router = useRouter()
const authStore = useAuthStore()
const store = useDatasetStore()

const projects = ref<{ id: string; name: string; updatedAt?: string }[]>([])
const loading = ref(true)
const errorMsg = ref('')
const showNewProjectDialog = ref(false)
const newProjectDefaultName = ref('')
const showRenameDialog = ref(false)
const renameProjectId = ref('')
const renameProjectName = ref('')
const showDeleteConfirm = ref(false)
const deleteProjectId = ref('')
const deleteProjectName = ref('')
const openDropdownId = ref<string | null>(null)
const contextMenuProject = ref<{ id: string; name: string } | null>(null)
const contextMenuX = ref(0)
const contextMenuY = ref(0)

const deleteConfirmMessage = computed(() =>
  deleteProjectName.value
    ? `Are you sure you want to delete project "${deleteProjectName.value}"? This cannot be undone.`
    : 'Are you sure you want to delete this project? This cannot be undone.'
)

function getDefaultProjectName() {
  const now = new Date()
  return `Project ${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

function openNewProjectDialog() {
  newProjectDefaultName.value = getDefaultProjectName()
  showNewProjectDialog.value = true
}

function handleLogout() {
  authStore.logout()
  router.replace('/Login')
}

async function loadProjects() {
  if (!authStore.user?.userId) return
  loading.value = true
  errorMsg.value = ''
  try {
    projects.value = await getProjects(authStore.user.userId)
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : 'Failed to load projects'
    projects.value = []
  } finally {
    loading.value = false
  }
}

async function openProject(projectId: string) {
  store.setCurrentProjectId(projectId)
  router.push(`/Visualize?projectId=${projectId}`)
}

function openRenameDialog(proj: { id: string; name: string }) {
  closeMenus()
  renameProjectId.value = proj.id
  renameProjectName.value = proj.name || 'Untitled'
  showRenameDialog.value = true
}

function closeMenus() {
  openDropdownId.value = null
  contextMenuProject.value = null
}

function toggleDropdown(projectId: string) {
  contextMenuProject.value = null
  openDropdownId.value = openDropdownId.value === projectId ? null : projectId
}

function onDropdownRename(proj: { id: string; name: string }) {
  closeMenus()
  openRenameDialog(proj)
}

function onDropdownDelete(proj: { id: string; name: string }) {
  closeMenus()
  openDeleteConfirm(proj)
}

function showContextMenu(e: MouseEvent, proj: { id: string; name: string }) {
  openDropdownId.value = null
  contextMenuProject.value = proj
  contextMenuX.value = e.clientX
  contextMenuY.value = e.clientY
}

function onContextRename() {
  if (contextMenuProject.value) {
    openRenameDialog(contextMenuProject.value)
    contextMenuProject.value = null
  }
}

function onContextDelete() {
  if (contextMenuProject.value) {
    openDeleteConfirm(contextMenuProject.value)
    contextMenuProject.value = null
  }
}

async function onRenameConfirm(name: string) {
  if (!renameProjectId.value) return
  try {
    await updateProjectName(renameProjectId.value, name.trim() || 'Untitled Project')
    const p = projects.value.find((x) => x.id === renameProjectId.value)
    if (p) p.name = name.trim() || 'Untitled Project'
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Rename failed'
  }
  renameProjectId.value = ''
}

function openDeleteConfirm(proj: { id: string; name: string }) {
  closeMenus()
  deleteProjectId.value = proj.id
  deleteProjectName.value = proj.name || 'Untitled'
  showDeleteConfirm.value = true
}

async function onDeleteConfirm() {
  if (!deleteProjectId.value) return
  try {
    await deleteProject(deleteProjectId.value)
    projects.value = projects.value.filter((p) => p.id !== deleteProjectId.value)
    if (store.currentProjectId === deleteProjectId.value) {
      store.setCurrentProjectId(null)
    }
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Delete failed'
  }
  deleteProjectId.value = ''
  deleteProjectName.value = ''
}

async function onNewProjectConfirm(name: string) {
  store.resetAll()
  if (!authStore.user?.userId) {
    router.replace('/Upload')
    return
  }
  try {
    const projectId = await createProject(authStore.user.userId, name.trim() || getDefaultProjectName())
    store.setCurrentProjectId(projectId)
  } catch (e) {
    console.warn('Failed to create project, will use default:', e)
  }
  router.replace('/Upload')
}

function handleClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (target.closest('.project-more-wrap') || target.closest('.context-menu')) return
  if (e.type === 'contextmenu' && target.closest('.project-item')) return
  closeMenus()
}

onMounted(() => {
  loadProjects()
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('contextmenu', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('contextmenu', handleClickOutside)
})
</script>

<style scoped>
/* 复用 Upload 的样式 */
.page-wrap {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow-x: hidden;
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
  position: relative;
  margin-bottom: -16px;
}

.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-logo {
  height: 40px;
  width: auto;
  object-fit: contain;
  margin-top: 4px;
}

.user-area {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-name {
  font-size: 14px;
  color: var(--text-secondary);
}

.btn-text {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--radius-xs);
  transition: color 0.2s, background 0.2s;
}

.btn-text:hover {
  color: var(--text-primary);
  background: var(--glass-bg-hover);
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

.subtitle {
  margin: 8px 0 0 0;
  font-size: 14px;
  color: var(--text-secondary);
}

.section {
  display: grid;
  gap: 8px;
}

.section-title {
  font-size: 16px;
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  margin: 0 0 6px 0;
}

.project-list-scroll {
  max-height: min(400px, 50vh);
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  border: 2px dashed var(--glass-border);
  border-radius: var(--radius-md);
  padding: 12px;
}

.project-list-scroll::-webkit-scrollbar {
  display: none;
}

.loading-hint,
.empty-hint {
  font-size: 14px;
  color: var(--text-tertiary);
  padding: 24px;
  text-align: center;
}

.error {
  color: var(--accent-red);
  font-size: 14px;
  padding: 12px;
}

.project-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.project-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  background: var(--glass-bg-hover);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
}

.project-item:hover {
  background: var(--glass-bg-active);
  border-color: var(--glass-border-hover);
}

.project-name {
  flex: 1;
  font-size: 15px;
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
}

.project-more-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.more-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: color 0.2s, background 0.2s;
}

.more-btn:hover {
  background: var(--glass-bg-hover);
  color: var(--text-primary);
}

.dropdown-menu {
  position: absolute;
  right: 0;
  top: 100%;
  margin-top: 4px;
  min-width: 140px;
  background: rgba(28, 32, 40, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: var(--radius-sm);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  padding: 6px 0;
  z-index: 1000;
}

.dropdown-item {
  display: block;
  width: 100%;
  padding: 10px 16px;
  border: none;
  background: none;
  color: #ffffff;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
  transition: background 0.2s;
}

.dropdown-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.context-menu {
  position: fixed;
  min-width: 140px;
  background: rgba(28, 32, 40, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: var(--radius-sm);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  padding: 6px 0;
  z-index: 10001;
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.footer {
  display: flex;
  justify-content: center;
  margin-top: 8px;
}

.btn {
  padding: 12px 28px;
  border-radius: var(--radius-full);
  border: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--letter-spacing-wide);
  text-transform: uppercase;
  transition: all var(--transition-base);
}

.btn.primary {
  background: var(--accent-white);
  color: var(--bg-primary);
  box-shadow: var(--shadow-float);
}

.btn.primary:hover {
  box-shadow: var(--glow-white-strong);
  transform: translateY(-2px);
}

.btn.full {
  width: 100%;
}
</style>
