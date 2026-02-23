import { BACKEND_CONFIG } from '../config/backend.config'

export interface ViewpointForBackend {
  x: number
  y: number
  z: number
  normalX: number
  normalY: number
  normalZ: number
}

export interface PlaybackHighlightResult {
  pastFaceIndices: number[]
  currentFaceIndices: number[]
}

function toWaypointData(v: { position: { x: number; y: number; z: number }; direction?: { x: number; y: number; z: number }; normal?: { x: number; y: number; z: number } }): ViewpointForBackend {
  let nx = 0, ny = -1, nz = 0
  if (v.direction && (v.direction.x || v.direction.y || v.direction.z)) {
    const d = v.direction
    const len = Math.sqrt(d.x * d.x + d.y * d.y + d.z * d.z)
    if (len > 0.001) {
      nx = d.x / len
      ny = d.y / len
      nz = d.z / len
    }
  } else if ((v as any).normal) {
    const n = (v as any).normal
    const len = Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z)
    if (len > 0.001) {
      nx = n.x / len
      ny = n.y / len
      nz = n.z / len
    }
  }
  return {
    x: v.position.x,
    y: v.position.y,
    z: v.position.z,
    normalX: nx,
    normalY: ny,
    normalZ: nz,
  }
}

export async function fetchPlaybackHighlight(
  pastViewpoints: Array<{ position: { x: number; y: number; z: number }; direction?: { x: number; y: number; z: number }; normal?: { x: number; y: number; z: number } }>,
  currentViewpoint: { position: { x: number; y: number; z: number }; direction?: { x: number; y: number; z: number }; normal?: { x: number; y: number; z: number } } | null,
  buildingMesh: { vertices: number[]; indices?: number[] },
  /** 外部传入则用于取消；取消时抛出 AbortError，不视为错误 */
  signal?: AbortSignal,
): Promise<PlaybackHighlightResult | null> {
  try {
    const past = (pastViewpoints || []).map(toWaypointData)
    const current = currentViewpoint ? toWaypointData(currentViewpoint) : null
    const body = {
      pastViewpoints: past,
      currentViewpoint: current,
      buildingMesh: {
        vertices: buildingMesh.vertices,
        indices: buildingMesh.indices && buildingMesh.indices.length > 0 ? buildingMesh.indices : undefined,
      },
    }
    const url = `${BACKEND_CONFIG.BASE_URL}${BACKEND_CONFIG.API_PREFIX}/${BACKEND_CONFIG.DEFAULT_PROJECT_ID}/playback-highlight`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)
    if (signal) {
      signal.addEventListener('abort', () => controller.abort(), { once: true })
    }
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    if (!response.ok) return null
    const data = await response.json()
    return {
      pastFaceIndices: data.pastFaceIndices || [],
      currentFaceIndices: data.currentFaceIndices || [],
    }
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return null
    console.warn('[backendPlaybackHighlight]', e)
    return null
  }
}
