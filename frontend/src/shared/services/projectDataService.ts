/**
 * Project data service - save/load model and waypoints to backend
 */
import { BACKEND_CONFIG } from '../config/backend.config'
import { useAuthStore } from '@/stores/auth'
import type { PathPoint } from '@/stores/dataset'

export interface WaypointPayload {
  x: number
  y: number
  z: number
  normalX: number
  normalY: number
  normalZ: number
}

export interface MeshDataPayload {
  vertices: number[]
  indices?: number[]
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const auth = useAuthStore().getAuthHeader()
  Object.assign(headers, auth)
  return headers
}

async function fetchOrThrow(
  url: string,
  options: RequestInit,
  context: string
): Promise<Response> {
  try {
    const res = await fetch(url, options)
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText)
      let msg = `${context}: ${res.status}`
      if (text) {
        try {
          const json = JSON.parse(text)
          if (json.message) msg += ` - ${json.message}`
          else if (typeof json === 'string') msg += ` - ${json}`
        } catch {
          if (text.length < 200) msg += ` - ${text}`
        }
      }
      throw new Error(msg)
    }
    return res
  } catch (e) {
    if (e instanceof Error) throw e
    if (String(e).includes('fetch') || String(e).includes('network'))
      throw new Error('Cannot connect to backend. Please ensure MongoDB and backend are running.')
    throw new Error(String(e))
  }
}

/** 创建新项目，返回 projectId */
export async function createProject(userId: string, name: string = 'Untitled Project'): Promise<string> {
  const res = await fetchOrThrow(
    `${BACKEND_CONFIG.BASE_URL}/api/projects`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name, description: '', userId }),
    },
    'Failed to create project'
  )
  const project = await res.json()
  return project.id
}

/** 删除项目 */
export async function deleteProject(projectId: string): Promise<void> {
  await fetchOrThrow(
    `${BACKEND_CONFIG.BASE_URL}/api/projects/${projectId}`,
    { method: 'DELETE', headers: getHeaders() },
    'Failed to delete project'
  )
}

/** 更新项目名称 */
export async function updateProjectName(projectId: string, name: string): Promise<void> {
  await fetchOrThrow(
    `${BACKEND_CONFIG.BASE_URL}/api/projects/${projectId}`,
    {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ name, description: '' }),
    },
    'Failed to update project name'
  )
}

/** Get or create project for user, returns projectId（仅在没有项目时创建，否则返回第一个） */
export async function getOrCreateProject(userId: string): Promise<string> {
  const base = BACKEND_CONFIG.BASE_URL
  const res = await fetchOrThrow(
    `${base}/api/projects?userId=${encodeURIComponent(userId)}`,
    { headers: getHeaders() },
    'Failed to load project list'
  )
  const projects = await res.json()
  if (projects && projects.length > 0) {
    return projects[0].id
  }
  const createRes = await fetchOrThrow(
    `${base}/api/projects`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        name: 'Default Project',
        description: '',
        userId,
      }),
    },
    'Failed to create project'
  )
  const project = await createRes.json()
  return project.id
}

/** 确保数值有效，避免 NaN/Infinity 导致后端解析失败 */
function sanitizeMeshData(mesh: MeshDataPayload): MeshDataPayload {
  const safe = (v: number) => (Number.isFinite(v) ? v : 0)
  return {
    vertices: mesh.vertices.map(safe),
    indices: mesh.indices?.map((i) => Math.floor(safe(i))) ?? undefined,
  }
}

/** Save model data to backend */
export async function saveModelData(
  projectId: string,
  meshData: MeshDataPayload,
  fileName: string = 'model.obj'
): Promise<void> {
  const sanitized = sanitizeMeshData(meshData)
  await fetchOrThrow(
    `${BACKEND_CONFIG.BASE_URL}/api/projects/${projectId}/model`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        meshData: {
          vertices: sanitized.vertices,
          indices: sanitized.indices,
        },
        fileName,
      }),
    },
    'Failed to save model'
  )
}

/** Save waypoints to backend */
export async function saveWaypoints(
  projectId: string,
  points: PathPoint[]
): Promise<void> {
  const payload: WaypointPayload[] = points.map((p) => ({
    x: p.x,
    y: p.y,
    z: p.z,
    normalX: p.normal.x,
    normalY: p.normal.y,
    normalZ: p.normal.z,
  }))
  await fetchOrThrow(
    `${BACKEND_CONFIG.BASE_URL}/api/projects/${projectId}/waypoints`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    },
    'Failed to save waypoints'
  )
}

/** 将顶点/索引数据展平为一维数字数组，兼容嵌套格式 */
function flattenToNumberArray(arr: unknown): number[] {
  if (!arr) return []
  if (Array.isArray(arr)) {
    const flat: number[] = []
    for (const item of arr) {
      if (typeof item === 'number' && Number.isFinite(item)) {
        flat.push(item)
      } else if (Array.isArray(item)) {
        for (const v of item) {
          if (typeof v === 'number' && Number.isFinite(v)) flat.push(v)
        }
      }
    }
    return flat
  }
  if (typeof arr === 'object' && arr !== null && !Array.isArray(arr)) {
    const obj = arr as Record<string, unknown>
    const keys = Object.keys(obj).filter((k) => /^\d+$/.test(k)).map(Number).sort((a, b) => a - b)
    return keys.map((k) => obj[String(k)]).filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  }
  return []
}

/** Load model data for a project */
export async function loadModelData(projectId: string): Promise<MeshDataPayload | null> {
  try {
    const res = await fetch(`${BACKEND_CONFIG.BASE_URL}/api/projects/${projectId}/model`, {
      headers: getHeaders(),
    })
    if (!res.ok) {
      console.warn('[loadModelData] 请求失败:', res.status, res.statusText)
      return null
    }
    const data = await res.json()
    const vertices = data?.vertices ?? data?.meshData?.vertices ?? data?.data?.vertices
    const indices = data?.indices ?? data?.meshData?.indices ?? data?.data?.indices
    const vertArr = flattenToNumberArray(vertices)
    if (vertArr.length < 9) {
      console.warn('[loadModelData] 顶点数据不足或格式错误:', vertArr.length, '个数值')
      return null
    }
    const idxArr = Array.isArray(indices) && indices.length > 0 ? flattenToNumberArray(indices) : undefined
    return {
      vertices: vertArr,
      indices: idxArr && idxArr.length > 0 ? idxArr : undefined,
    }
  } catch (e) {
    console.warn('[loadModelData] 加载失败:', e)
    return null
  }
}

/** Load waypoints for a project */
export async function loadWaypoints(projectId: string): Promise<PathPoint[]> {
  try {
    const res = await fetch(`${BACKEND_CONFIG.BASE_URL}/api/projects/${projectId}/waypoints`, {
      headers: getHeaders(),
    })
    if (!res.ok) return []
    const list = await res.json()
    if (!Array.isArray(list)) return []
    return list.map((wp: { x?: number; y?: number; z?: number; normalX?: number; normalY?: number; normalZ?: number }, i: number) => ({
    id: i + 1,
    x: typeof wp.x === 'number' && Number.isFinite(wp.x) ? wp.x : 0,
    y: typeof wp.y === 'number' && Number.isFinite(wp.y) ? wp.y : 0,
    z: typeof wp.z === 'number' && Number.isFinite(wp.z) ? wp.z : 0,
    normal: {
      x: wp.normalX ?? 0,
      y: wp.normalY ?? -1,
      z: wp.normalZ ?? 0,
    },
  }))
  } catch {
    return []
  }
}

/** Get all projects for user */
export async function getProjects(userId: string): Promise<{ id: string; name: string; updatedAt?: string }[]> {
  if (!BACKEND_CONFIG.ENABLED) return []
  const res = await fetchOrThrow(
    `${BACKEND_CONFIG.BASE_URL}/api/projects?userId=${encodeURIComponent(userId)}`,
    { headers: getHeaders() },
    'Failed to load project list'
  )
  const projects = await res.json()
  return Array.isArray(projects) ? projects : []
}

/** Save model and waypoints for current user */
export async function saveProjectData(
  userId: string,
  meshData: MeshDataPayload | null,
  points: PathPoint[],
  modelFileName: string = 'model.obj',
  /** 为 true 时仅保存航点，不保存模型（用于编辑路径后保存，模型未变更） */
  waypointsOnly?: boolean,
  /** 指定项目 ID（从 Home 打开项目时传入，否则自动 getOrCreate） */
  projectIdOverride?: string | null
): Promise<void> {
  if (!BACKEND_CONFIG.ENABLED) return
  const projectId = projectIdOverride || await getOrCreateProject(userId)
  if (!waypointsOnly && meshData && meshData.vertices && meshData.vertices.length > 0) {
    await saveModelData(projectId, meshData, modelFileName)
  }
  if (points.length > 0) {
    await saveWaypoints(projectId, points)
  }
}
