
// Use a simplified version of PathPoint for specific worker usage if needed,
// or define the interface locally to avoid import dependencies that might break in some worker setups.
interface WorkerPathPoint {
  id: number
  x: number
  y: number
  z: number
  [key: string]: any
}

interface MeshDataInput {
  vertices: number[]
  indices?: number[]
}

interface VoxelGrid {
  data: boolean[]
  nx: number
  ny: number
  nz: number
  minX: number
  minY: number
  minZ: number
  maxX: number
  maxY: number
  maxZ: number
}

const GRID_RES = 64

// ============================================================
// 代价函数 — 带碰撞惩罚
// 碰撞线段代价 = 实际距离 + 巨大惩罚
// ============================================================
const COLLISION_PENALTY = 1e6

function distance3D(p1: { x: number; y: number; z: number }, p2: { x: number; y: number; z: number }): number {
  const dx = p1.x - p2.x
  const dy = p1.y - p2.y
  const dz = p1.z - p2.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

function reverseSegment(arr: any[], start: number, end: number) {
  let l = start
  let r = end
  while (l < r) {
    const temp = arr[l]
    arr[l] = arr[r]
    arr[r] = temp
    l++
    r--
  }
}

// ============================================================
// 体素网格碰撞检测 —— 3D DDA (Amanatides & Woo)
// 性能 O(穿过的体素数)，不受总体素数影响
// ============================================================
function segmentCollidesVoxelGrid(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
  vg: VoxelGrid
): boolean {
  const { data, nx, ny, nz, minX, minY, minZ, maxX, maxY, maxZ } = vg
  const dx = maxX - minX
  const dy = maxY - minY
  const dz = maxZ - minZ
  const ddx = dx < 1e-9 ? 1 : dx
  const ddy = dy < 1e-9 ? 1 : dy
  const ddz = dz < 1e-9 ? 1 : dz

  const segLen = distance3D(a, b)
  if (segLen < 1e-9) {
    const gx = Math.floor(((a.x - minX) / ddx) * (nx - 1e-9))
    const gy = Math.floor(((a.y - minY) / ddy) * (ny - 1e-9))
    const gz = Math.floor(((a.z - minZ) / ddz) * (nz - 1e-9))
    if (gx >= 0 && gx < nx && gy >= 0 && gy < ny && gz >= 0 && gz < nz) {
      return data[gx + gy * nx + gz * nx * ny]!
    }
    return false
  }

  const dirX = (b.x - a.x) / segLen
  const dirY = (b.y - a.y) / segLen
  const dirZ = (b.z - a.z) / segLen

  let dX = Math.abs(dirX) < 1e-12 ? 1e-12 : dirX
  let dY = Math.abs(dirY) < 1e-12 ? 1e-12 : dirY
  let dZ = Math.abs(dirZ) < 1e-12 ? 1e-12 : dirZ

  let ix = Math.floor(((a.x - minX) / ddx) * (nx - 1e-9))
  let iy = Math.floor(((a.y - minY) / ddy) * (ny - 1e-9))
  let iz = Math.floor(((a.z - minZ) / ddz) * (nz - 1e-9))

  ix = Math.max(0, Math.min(nx - 1, ix))
  iy = Math.max(0, Math.min(ny - 1, iy))
  iz = Math.max(0, Math.min(nz - 1, iz))

  const stepX = dX > 0 ? 1 : -1
  const stepY = dY > 0 ? 1 : -1
  const stepZ = dZ > 0 ? 1 : -1

  const voxelSizeX = ddx / nx
  const voxelSizeY = ddy / ny
  const voxelSizeZ = ddz / nz

  let nextX = dX > 0 ? minX + (ix + 1) * voxelSizeX : minX + ix * voxelSizeX
  let nextY = dY > 0 ? minY + (iy + 1) * voxelSizeY : minY + iy * voxelSizeY
  let nextZ = dZ > 0 ? minZ + (iz + 1) * voxelSizeZ : minZ + iz * voxelSizeZ

  let tMaxX = dX !== 0 ? (nextX - a.x) / dX : Infinity
  let tMaxY = dY !== 0 ? (nextY - a.y) / dY : Infinity
  let tMaxZ = dZ !== 0 ? (nextZ - a.z) / dZ : Infinity

  const tDeltaX = dX !== 0 ? voxelSizeX / Math.abs(dX) : Infinity
  const tDeltaY = dY !== 0 ? voxelSizeY / Math.abs(dY) : Infinity
  const tDeltaZ = dZ !== 0 ? voxelSizeZ / Math.abs(dZ) : Infinity

  let t = 0
  while (t <= segLen) {
    if (ix >= 0 && ix < nx && iy >= 0 && iy < ny && iz >= 0 && iz < nz) {
      if (data[ix + iy * nx + iz * nx * ny]!) {
        return true
      }
    }

    if (tMaxX <= tMaxY && tMaxX <= tMaxZ) {
      t = tMaxX
      tMaxX += tDeltaX
      ix += stepX
    } else if (tMaxY <= tMaxX && tMaxY <= tMaxZ) {
      t = tMaxY
      tMaxY += tDeltaY
      iy += stepY
    } else {
      t = tMaxZ
      tMaxZ += tDeltaZ
      iz += stepZ
    }
  }

  return false
}

/** 三角面体素化：遍历三角面，用每个三角面的 AABB 映射到体素网格并标记占用 */
function buildVoxelGrid(mesh: MeshDataInput): VoxelGrid | null {
  const { vertices, indices } = mesh
  if (!vertices || vertices.length < 9) return null

  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let maxZ = -Infinity

  for (let i = 0; i < vertices.length; i += 3) {
    const x = vertices[i]!
    const y = vertices[i + 1]!
    const z = vertices[i + 2]!
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    minZ = Math.min(minZ, z)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
    maxZ = Math.max(maxZ, z)
  }

  const nx = GRID_RES
  const ny = GRID_RES
  const nz = GRID_RES
  const data = new Array<boolean>(nx * ny * nz).fill(false)

  const dx = maxX - minX
  const dy = maxY - minY
  const dz = maxZ - minZ
  const ddx = dx < 1e-9 ? 1 : dx
  const ddy = dy < 1e-9 ? 1 : dy
  const ddz = dz < 1e-9 ? 1 : dz

  const triCount = indices && indices.length >= 3 ? indices.length / 3 : vertices.length / 9

  for (let t = 0; t < triCount; t++) {
    let v0x: number, v0y: number, v0z: number
    let v1x: number, v1y: number, v1z: number
    let v2x: number, v2y: number, v2z: number

    if (indices && indices.length >= 3) {
      const i0 = indices[t * 3]!
      const i1 = indices[t * 3 + 1]!
      const i2 = indices[t * 3 + 2]!
      if (i0 * 3 + 2 >= vertices.length || i1 * 3 + 2 >= vertices.length || i2 * 3 + 2 >= vertices.length) continue
      v0x = vertices[i0 * 3]!
      v0y = vertices[i0 * 3 + 1]!
      v0z = vertices[i0 * 3 + 2]!
      v1x = vertices[i1 * 3]!
      v1y = vertices[i1 * 3 + 1]!
      v1z = vertices[i1 * 3 + 2]!
      v2x = vertices[i2 * 3]!
      v2y = vertices[i2 * 3 + 1]!
      v2z = vertices[i2 * 3 + 2]!
    } else {
      const base = t * 9
      v0x = vertices[base]!
      v0y = vertices[base + 1]!
      v0z = vertices[base + 2]!
      v1x = vertices[base + 3]!
      v1y = vertices[base + 4]!
      v1z = vertices[base + 5]!
      v2x = vertices[base + 6]!
      v2y = vertices[base + 7]!
      v2z = vertices[base + 8]!
    }

    const triMinX = Math.min(v0x, v1x, v2x)
    const triMinY = Math.min(v0y, v1y, v2y)
    const triMinZ = Math.min(v0z, v1z, v2z)
    const triMaxX = Math.max(v0x, v1x, v2x)
    const triMaxY = Math.max(v0y, v1y, v2y)
    const triMaxZ = Math.max(v0z, v1z, v2z)

    let gx0 = Math.floor(((triMinX - minX) / ddx) * (nx - 1e-9))
    let gy0 = Math.floor(((triMinY - minY) / ddy) * (ny - 1e-9))
    let gz0 = Math.floor(((triMinZ - minZ) / ddz) * (nz - 1e-9))
    let gx1 = Math.floor(((triMaxX - minX) / ddx) * (nx - 1e-9))
    let gy1 = Math.floor(((triMaxY - minY) / ddy) * (ny - 1e-9))
    let gz1 = Math.floor(((triMaxZ - minZ) / ddz) * (nz - 1e-9))

    gx0 = Math.max(0, Math.min(nx - 1, gx0))
    gy0 = Math.max(0, Math.min(ny - 1, gy0))
    gz0 = Math.max(0, Math.min(nz - 1, gz0))
    gx1 = Math.max(0, Math.min(nx - 1, gx1))
    gy1 = Math.max(0, Math.min(ny - 1, gy1))
    gz1 = Math.max(0, Math.min(nz - 1, gz1))

    for (let gx = gx0; gx <= gx1; gx++) {
      for (let gy = gy0; gy <= gy1; gy++) {
        for (let gz = gz0; gz <= gz1; gz++) {
          data[gx + gy * nx + gz * nx * ny] = true
        }
      }
    }
  }

  return {
    data,
    nx,
    ny,
    nz,
    minX,
    minY,
    minZ,
    maxX,
    maxY,
    maxZ,
  }
}

/** 带碰撞惩罚的路径段代价 */
function getCost(
  a: WorkerPathPoint,
  b: WorkerPathPoint,
  vg: VoxelGrid | null
): number {
  const dist = distance3D(a, b)
  if (vg && segmentCollidesVoxelGrid(a, b, vg)) {
    return dist + COLLISION_PENALTY
  }
  return dist
}

function calculateOptimalPath(
  points: WorkerPathPoint[],
  meshData?: MeshDataInput | null
): WorkerPathPoint[] {
  if (points.length <= 3) {
    return [...points]
  }

  const vg = meshData ? buildVoxelGrid(meshData) : null

  const originalPoints = [...points]
  const startPoint = originalPoints[0]!
  const otherPoints = originalPoints.slice(1)

  const path = [startPoint]
  const unvisited = new Set(otherPoints)

  let current = startPoint

  // 1. Nearest Neighbor（带碰撞惩罚）
  while (unvisited.size > 0) {
    let nearest: WorkerPathPoint | null = null
    let minCost = Infinity

    for (const p of unvisited) {
      const cost = getCost(current, p, vg)
      if (cost < minCost) {
        minCost = cost
        nearest = p
      }
    }

    if (nearest) {
      path.push(nearest)
      unvisited.delete(nearest)
      current = nearest
    } else {
      break
    }
  }

  // 2. 2-Opt Optimization（带碰撞惩罚）
  let improved = true
  let iterations = 0
  const maxIterations = 50

  while (improved && iterations < maxIterations) {
    improved = false
    iterations++

    for (let i = 1; i < path.length - 1; i++) {
      for (let k = i + 1; k < path.length; k++) {
        const p_i_minus_1 = path[i - 1]!
        const p_i = path[i]!
        const p_k = path[k]!
        const p_k_plus_1 = k + 1 < path.length ? path[k + 1]! : null

        const currentCost =
          getCost(p_i_minus_1, p_i, vg) +
          (p_k_plus_1 ? getCost(p_k, p_k_plus_1, vg) : 0)
        const newCost =
          getCost(p_i_minus_1, p_k, vg) +
          (p_k_plus_1 ? getCost(p_i, p_k_plus_1, vg) : 0)

        if (newCost < currentCost) {
          reverseSegment(path, i, k)
          improved = true
        }
      }
    }
  }

  return path
}

self.onmessage = (e: MessageEvent) => {
  const data = e.data
  try {
    let points: WorkerPathPoint[]
    let meshData: MeshDataInput | null = null

    if (Array.isArray(data)) {
      points = data
    } else if (data && Array.isArray(data.points)) {
      points = data.points
      meshData = data.meshData ?? null
    } else {
      throw new Error('Invalid worker input: expected points array or { points, meshData? }')
    }

    const optimized = calculateOptimalPath(points, meshData)
    self.postMessage({ success: true, points: optimized })
  } catch (error) {
    self.postMessage({ success: false, error: String(error) })
  }
}
