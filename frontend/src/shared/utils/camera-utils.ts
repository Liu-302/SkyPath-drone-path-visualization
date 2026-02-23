/**
 * 相机和视锥体计算工具
 * 
 * 文件作用：
 * - 提供相机视锥体计算函数
 * - 计算视锥体角点、投影、可见面等
 */

import type { CameraView, FrustumCorners } from '@/features/visualization/types/camera'
import { Vector3, Vector4, BufferGeometry, BufferAttribute, Box3, Raycaster } from 'three'

// Helper: estimate camera position from frustum by minimizing distance to lines defined by (near[i], far[i])
export function estimateCameraPositionFromFrustum(frustum: FrustumCorners): Vector3 {
  const lines: { a: Vector3; dir: Vector3 }[] = []
  for (let i = 0; i < frustum.near.length; i++) {
    const a = new Vector3(frustum.near[i].x, frustum.near[i].y, frustum.near[i].z)
    const b = new Vector3(frustum.far[i].x, frustum.far[i].y, frustum.far[i].z)
    const dir = new Vector3().subVectors(b, a).normalize()
    lines.push({ a, dir })
  }

  // Solve for point p that minimizes sum || (I - u u^T)(p - a) ||^2
  // Build linear system: A p = b
  let A = new Array(3).fill(0).map(() => new Array(3).fill(0))
  let B = new Array(3).fill(0)

  for (const { a, dir: u } of lines) {
    // Compute I - u u^T
    const uu = [u.x * u.x, u.x * u.y, u.x * u.z,
                u.y * u.x, u.y * u.y, u.y * u.z,
                u.z * u.x, u.z * u.y, u.z * u.z]
    const IminusUU = [1 - uu[0], -uu[1], -uu[2], -uu[3], 1 - uu[4], -uu[5], -uu[6], -uu[7], 1 - uu[8]]

    // accumulate A and B
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        A[r][c] += IminusUU[r * 3 + c]
      }
      const val = IminusUU[r * 3 + 0] * a.x + IminusUU[r * 3 + 1] * a.y + IminusUU[r * 3 + 2] * a.z
      B[r] += val
    }
  }

  // Solve 3x3 linear system A * p = B using Cramer's rule (sufficient for small matrices)
  const detA = (
    A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) -
    A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) +
    A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0])
  )

  if (Math.abs(detA) < 1e-9) {
    // fallback: average of near centers
    const avg = new Vector3()
    for (const n of frustum.near) avg.add(new Vector3(n.x, n.y, n.z))
    return avg.multiplyScalar(1 / frustum.near.length)
  }

  function detReplace(col: number) {
    const M = [
      [B[0], A[0][(col + 1) % 3], A[0][(col + 2) % 3]],
      [B[1], A[1][(col + 1) % 3], A[1][(col + 2) % 3]],
      [B[2], A[2][(col + 1) % 3], A[2][(col + 2) % 3]]
    ]
    return (
      M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) -
      M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) +
      M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0])
    )
  }

  // Solve for px, py, pz by replacing columns
  const px = detReplace(0) / detA
  // reconstruct for py/pz more directly using linear solver (simple Gauss elimination)
  // We'll perform a simple inversion for stability
  // Compute inverse of A (3x3)
  const invA = new Array(3).fill(0).map(() => new Array(3).fill(0))
  invA[0][0] = (A[1][1] * A[2][2] - A[1][2] * A[2][1]) / detA
  invA[0][1] = (A[0][2] * A[2][1] - A[0][1] * A[2][2]) / detA
  invA[0][2] = (A[0][1] * A[1][2] - A[0][2] * A[1][1]) / detA
  invA[1][0] = (A[1][2] * A[2][0] - A[1][0] * A[2][2]) / detA
  invA[1][1] = (A[0][0] * A[2][2] - A[0][2] * A[2][0]) / detA
  invA[1][2] = (A[0][2] * A[1][0] - A[0][0] * A[1][2]) / detA
  invA[2][0] = (A[1][0] * A[2][1] - A[1][1] * A[2][0]) / detA
  invA[2][1] = (A[0][1] * A[2][0] - A[0][0] * A[2][1]) / detA
  invA[2][2] = (A[0][0] * A[1][1] - A[0][1] * A[1][0]) / detA

  const py = invA[1][0] * B[0] + invA[1][1] * B[1] + invA[1][2] * B[2]
  const pz = invA[2][0] * B[0] + invA[2][1] * B[1] + invA[2][2] * B[2]

  return new Vector3(px, py, pz)
}

/**
 * 计算视锥体的八个角点
 * 
 * @param position 相机位置
 * @param direction 相机朝向向量（归一化）
 * @param up 相机上方向向量（归一化）
 * @param fov 视场角（度）
 * @param aspect 宽高比
 * @param near 近平面距离
 * @param far 远平面距离
 * @returns 视锥体八个角点
 * 
 * 基于Python文件中的多面体投影思想，结合Three.js数学计算
 */
export function calculateFrustumCorners(
  position: { x: number; y: number; z: number },
  direction: { x: number; y: number; z: number },
  up: { x: number; y: number; z: number },
  fov: number,
  aspect: number,
  near: number,
  far: number
): FrustumCorners {
  // 将角度转换为弧度
  const fovRad = (fov * Math.PI) / 180
  
  // 计算近平面和远平面的高度和宽度
  const nearHeight = 2 * Math.tan(fovRad / 2) * near
  const nearWidth = nearHeight * aspect
  
  const farHeight = 2 * Math.tan(fovRad / 2) * far
  const farWidth = farHeight * aspect
  
  // 根据Python文件的思路，计算正交向量
  const right = new Vector3()
  right.crossVectors(new Vector3(direction.x, direction.y, direction.z), 
                    new Vector3(up.x, up.y, up.z))
  right.normalize()
  
  // 调试信息：输出相机方向和坐标系（已注释）
  // console.log('calculateFrustumCorners调试信息:')
  // console.log(`相机位置: (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`)
  // console.log(`相机方向: (${direction.x.toFixed(3)}, ${direction.y.toFixed(3)}, ${direction.z.toFixed(3)})`)
  // console.log(`相机上方向: (${up.x.toFixed(3)}, ${up.y.toFixed(3)}, ${up.z.toFixed(3)})`)
  // console.log(`右向量: (${right.x.toFixed(3)}, ${right.y.toFixed(3)}, ${right.z.toFixed(3)})`)
  // console.log(`近平面尺寸: ${nearWidth.toFixed(2)} × ${nearHeight.toFixed(2)}`)
  // console.log(`远平面尺寸: ${farWidth.toFixed(2)} × ${farHeight.toFixed(2)}`)
  
  // 计算近平面四个角点
  const nearCenter = new Vector3(
    position.x + direction.x * near,
    position.y + direction.y * near,
    position.z + direction.z * near
  )
  
  const nearHalfWidth = nearWidth / 2
  const nearHalfHeight = nearHeight / 2
  
  const nearCorners = [
    // 左下 (left, bottom)
    new Vector3(
      nearCenter.x - right.x * nearHalfWidth - up.x * nearHalfHeight,
      nearCenter.y - right.y * nearHalfWidth - up.y * nearHalfHeight,
      nearCenter.z - right.z * nearHalfWidth - up.z * nearHalfHeight
    ),
    // 右下 (right, bottom)
    new Vector3(
      nearCenter.x + right.x * nearHalfWidth - up.x * nearHalfHeight,
      nearCenter.y + right.y * nearHalfWidth - up.y * nearHalfHeight,
      nearCenter.z + right.z * nearHalfWidth - up.z * nearHalfHeight
    ),
    // 右上 (right, top)
    new Vector3(
      nearCenter.x + right.x * nearHalfWidth + up.x * nearHalfHeight,
      nearCenter.y + right.y * nearHalfWidth + up.y * nearHalfHeight,
      nearCenter.z + right.z * nearHalfWidth + up.z * nearHalfHeight
    ),
    // 左上 (left, top)
    new Vector3(
      nearCenter.x - right.x * nearHalfWidth + up.x * nearHalfHeight,
      nearCenter.y - right.y * nearHalfWidth + up.y * nearHalfHeight,
      nearCenter.z - right.z * nearHalfWidth + up.z * nearHalfHeight
    )
  ]
  
  // 计算远平面四个角点
  const farCenter = new Vector3(
    position.x + direction.x * far,
    position.y + direction.y * far,
    position.z + direction.z * far
  )
  
  const farHalfWidth = farWidth / 2
  const farHalfHeight = farHeight / 2
  
  const farCorners = [
    // 左下 (left, bottom)
    new Vector3(
      farCenter.x - right.x * farHalfWidth - up.x * farHalfHeight,
      farCenter.y - right.y * farHalfWidth - up.y * farHalfHeight,
      farCenter.z - right.z * farHalfWidth - up.z * farHalfHeight
    ),
    // 右下 (right, bottom)
    new Vector3(
      farCenter.x + right.x * farHalfWidth - up.x * farHalfHeight,
      farCenter.y + right.y * farHalfWidth - up.y * farHalfHeight,
      farCenter.z + right.z * farHalfWidth - up.z * farHalfHeight
    ),
    // 右上 (right, top)
    new Vector3(
      farCenter.x + right.x * farHalfWidth + up.x * farHalfHeight,
      farCenter.y + right.y * farHalfWidth + up.y * farHalfHeight,
      farCenter.z + right.z * farHalfWidth + up.z * farHalfHeight
    ),
    // 左上 (left, top)
    new Vector3(
      farCenter.x - right.x * farHalfWidth + up.x * farHalfHeight,
      farCenter.y - right.y * farHalfWidth + up.y * farHalfHeight,
      farCenter.z - right.z * farHalfWidth + up.z * farHalfHeight
    )
  ]
  
  // 调试信息：输出视锥体角点坐标（已注释）
  // console.log('近平面角点坐标:')
  // nearCorners.forEach((corner, i) => {
  //   console.log(`   角点${i}: (${corner.x.toFixed(2)}, ${corner.y.toFixed(2)}, ${corner.z.toFixed(2)})`)
  // })
  // console.log('远平面角点坐标:')
  // farCorners.forEach((corner, i) => {
  //   console.log(`   角点${i}: (${corner.x.toFixed(2)}, ${corner.y.toFixed(2)}, ${corner.z.toFixed(2)})`)
  // })
  
  // 转换为接口要求的格式
  return {
    near: nearCorners.map(v => ({ x: v.x, y: v.y, z: v.z })) as any,
    far: farCorners.map(v => ({ x: v.x, y: v.y, z: v.z })) as any,
  }
}

/**
 * 计算相机朝向向量
 * 
 * @param position 相机位置
 * @param target 目标点
 * @returns 归一化的朝向向量
 */
export function getCameraDirection(
  position: { x: number; y: number; z: number },
  target: { x: number; y: number; z: number }
): { x: number; y: number; z: number } {
  const dx = target.x - position.x
  const dy = target.y - position.y
  const dz = target.z - position.z
  const length = Math.sqrt(dx * dx + dy * dy + dz * dz)
  
  if (length === 0) {
    return { x: 0, y: -1, z: 0 } // 默认向下
  }
  
  return {
    x: dx / length,
    y: dy / length,
    z: dz / length,
  }
}

// ============================================================
// Pyramid (4-sided frustum) utilities
// 用于与后端“四棱锥/四面体”判定保持一致
// ============================================================

export type Pyramid = {
  apex: Vector3
  base: [Vector3, Vector3, Vector3, Vector3] // b1..b4 around the rectangle
}

type ClipPlane = Vector4 // (nx, ny, nz, d) where dot(n, p) + d >= 0 means inside

/**
 * VFOV + aspect 推导 HFOV（度）
 */
export function vfovToHfov(vfovDeg: number, aspect: number): number {
  const vfovRad = (vfovDeg * Math.PI) / 180
  const hfovRad = 2 * Math.atan(Math.tan(vfovRad / 2) * aspect)
  return (hfovRad * 180) / Math.PI
}

/**
 * 动态 h：从相机位置沿 direction 发射射线，取与 mesh 的最近命中距离。
 * 与后端 computeDynamicH 一致，使用第一个命中（不做朝向过滤），保证高亮与 KPI 覆盖率计算准确。
 */
export function computeDynamicHToMesh(
  position: { x: number; y: number; z: number },
  direction: { x: number; y: number; z: number },
  mesh: any,
  far: number,
): number {
  if (!mesh) return far
  const origin = new Vector3(position.x, position.y, position.z)
  const dir = new Vector3(direction.x, direction.y, direction.z)
  if (dir.length() < 1e-6) return far
  dir.normalize()

  if (typeof mesh.updateWorldMatrix === 'function') {
    mesh.updateWorldMatrix(true, true)
  }

  const raycaster = new Raycaster()
  raycaster.set(origin, dir)
  raycaster.near = 1e-4
  raycaster.far = far

  const hits = raycaster.intersectObject(mesh, true)
  if (hits && hits.length > 0) {
    const d0 = hits[0]?.distance
    if (typeof d0 === 'number' && d0 > 0) return d0
  }

  const box = new Box3().setFromObject(mesh)
  if (!box.isEmpty()) {
    const center = box.getCenter(new Vector3())
    const toCenter = center.clone().sub(origin)
    const distAlongRay = toCenter.dot(dir)
    if (distAlongRay > 0) {
      const size = box.getSize(new Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)
      return Math.min(far, Math.max(distAlongRay, maxDim * 0.5))
    }
  }
  return far
}

/**
 * 根据 (position, direction, vfov/hfov, h) 构造有限四棱锥：
 * apex = position
 * baseCenter = position + h * direction
 * base size: halfW = tan(HFOV/2)*h, halfL = tan(VFOV/2)*h
 */
export function buildPyramidFromCamera(
  position: { x: number; y: number; z: number },
  direction: { x: number; y: number; z: number },
  vfovDeg: number,
  hfovDeg: number,
  h: number,
): Pyramid {
  const v = new Vector3(position.x, position.y, position.z)
  const d = new Vector3(direction.x, direction.y, direction.z).normalize()

  // stable worldUp (match backend logic)
  let worldUp = new Vector3(0, 1, 0)
  if (Math.abs(d.dot(worldUp)) > 0.98) {
    worldUp = new Vector3(0, 0, 1)
  }

  const right = new Vector3().crossVectors(d, worldUp).normalize()
  const up = new Vector3().crossVectors(right, d).normalize()

  const hfovRad = (hfovDeg * Math.PI) / 180
  const vfovRad = (vfovDeg * Math.PI) / 180
  const halfW = Math.tan(hfovRad / 2) * h
  const halfL = Math.tan(vfovRad / 2) * h

  const c = v.clone().add(d.clone().multiplyScalar(h))

  const b1 = c.clone().add(right.clone().multiplyScalar(halfW)).add(up.clone().multiplyScalar(halfL))
  const b2 = c.clone().add(right.clone().multiplyScalar(-halfW)).add(up.clone().multiplyScalar(halfL))
  const b3 = c.clone().add(right.clone().multiplyScalar(-halfW)).add(up.clone().multiplyScalar(-halfL))
  const b4 = c.clone().add(right.clone().multiplyScalar(halfW)).add(up.clone().multiplyScalar(-halfL))

  return { apex: v, base: [b1, b2, b3, b4] }
}

function pyramidBoundingBox(p: Pyramid): Box3 {
  const box = new Box3()
  box.expandByPoint(p.apex)
  p.base.forEach(pt => box.expandByPoint(pt))
  return box
}

function det3(a: Vector3, b: Vector3, c: Vector3): number {
  // det([a b c]) = a · (b × c)
  return a.dot(new Vector3().crossVectors(b, c))
}

function isPointInsideTetrahedron(point: Vector3, v: Vector3, a: Vector3, b: Vector3, c: Vector3): boolean {
  const pv = point.clone().sub(v)
  const av = a.clone().sub(v)
  const bv = b.clone().sub(v)
  const cv = c.clone().sub(v)

  const detM = det3(av, bv, cv)
  if (Math.abs(detM) < 1e-18) return false

  const beta = det3(pv, bv, cv) / detM
  const gamma = det3(av, pv, cv) / detM
  const delta = det3(av, bv, pv) / detM
  const alpha = 1 - beta - gamma - delta

  const eps = 1e-9
  return (
    alpha >= -eps && beta >= -eps && gamma >= -eps && delta >= -eps &&
    alpha <= 1 + eps && beta <= 1 + eps && gamma <= 1 + eps && delta <= 1 + eps
  )
}

function isPointInsidePyramid(point: Vector3, p: Pyramid): boolean {
  const v = p.apex
  const [b1, b2, b3, b4] = p.base
  // split along diagonal b1-b3
  return isPointInsideTetrahedron(point, v, b1, b2, b3) || isPointInsideTetrahedron(point, v, b1, b3, b4)
}

function planeFromPoints(a: Vector3, b: Vector3, c: Vector3): ClipPlane {
  const ab = new Vector3().subVectors(b, a)
  const ac = new Vector3().subVectors(c, a)
  const n = new Vector3().crossVectors(ab, ac)
  const len = n.length()
  if (len < 1e-12) {
    // degenerate; return a harmless plane that always passes
    return new Vector4(0, 0, 0, 0)
  }
  n.multiplyScalar(1 / len)
  const d = -n.dot(a)
  return new Vector4(n.x, n.y, n.z, d)
}

function ensurePlaneFacesInside(plane: ClipPlane, insidePoint: Vector3): ClipPlane {
  const dist = plane.x * insidePoint.x + plane.y * insidePoint.y + plane.z * insidePoint.z + plane.w
  if (dist >= 0) return plane
  return new Vector4(-plane.x, -plane.y, -plane.z, -plane.w)
}

function buildPyramidClipPlanes(pyramid: Pyramid): ClipPlane[] {
  const v = pyramid.apex
  const [b1, b2, b3, b4] = pyramid.base
  const baseCenter = new Vector3().addVectors(b1, b2).add(b3).add(b4).multiplyScalar(0.25)
  const insidePoint = v.clone().lerp(baseCenter, 0.5)

  // 4 side planes: each through apex + two adjacent base corners
  const side = [
    planeFromPoints(v, b1, b2),
    planeFromPoints(v, b2, b3),
    planeFromPoints(v, b3, b4),
    planeFromPoints(v, b4, b1),
  ].map(p => ensurePlaneFacesInside(p, insidePoint))

  // base plane: through three base corners
  const base = ensurePlaneFacesInside(planeFromPoints(b1, b2, b3), insidePoint)

  // Note: side + base planes already bound a finite pyramid (convex polyhedron) as long as
  // they are consistently oriented to contain insidePoint.
  return [...side, base]
}

function signedDistanceToPlane(p: Vector3, plane: ClipPlane): number {
  return plane.x * p.x + plane.y * p.y + plane.z * p.z + plane.w
}

/**
 * Clip a 3D polygon (in world space) by a plane halfspace: dot(n, p) + d >= 0 is inside.
 * Returns the clipped polygon vertices (may be empty).
 */
function clipPolygonByPlane(poly: Vector3[], plane: ClipPlane, eps = 1e-9): Vector3[] {
  if (poly.length === 0) return []
  const out: Vector3[] = []
  const n = poly.length
  for (let i = 0; i < n; i++) {
    const curr = poly[i]
    const next = poly[(i + 1) % n]
    const dc = signedDistanceToPlane(curr, plane)
    const dn = signedDistanceToPlane(next, plane)
    const currIn = dc >= -eps
    const nextIn = dn >= -eps

    if (currIn && nextIn) {
      // keep next
      out.push(next.clone())
    } else if (currIn && !nextIn) {
      // leaving: keep intersection
      const denom = dc - dn
      if (Math.abs(denom) > 1e-18) {
        const t = dc / denom
        out.push(curr.clone().lerp(next, t))
      }
    } else if (!currIn && nextIn) {
      // entering: keep intersection + next
      const denom = dc - dn
      if (Math.abs(denom) > 1e-18) {
        const t = dc / denom
        out.push(curr.clone().lerp(next, t))
      }
      out.push(next.clone())
    } else {
      // both outside: nothing
    }
  }
  return out
}

/**
 * Conservative-but-accurate intersection test:
 * Intersect triangle with the convex pyramid halfspaces via polygon clipping.
 * If any part of the triangle lies inside the pyramid, returns true.
 */
function triangleIntersectsPyramid(a: Vector3, b: Vector3, c: Vector3, pyramidPlanes: ClipPlane[]): boolean {
  let poly: Vector3[] = [a, b, c]
  for (const pl of pyramidPlanes) {
    poly = clipPolygonByPlane(poly, pl, 1e-5)
    if (poly.length === 0) return false
  }
  // If clipping left at least a point/segment/polygon, we count it as intersection.
  return poly.length > 0
}

/**
 * 获取四棱锥内可见的面（与后端覆盖判定保持一致）：
 * - 三角面与四棱锥体积相交（通过平面半空间裁剪判断）
 * - 且三角面朝向相机（normal · viewDir >= 0）
 */
export function getVisibleMeshFacesByPyramid(
  pyramid: Pyramid,
  mesh: any,
  cameraPosition: { x: number; y: number; z: number },
  options?: { requireFacing?: boolean },
): number[] {
  if (!mesh || !mesh.geometry) return []

  const geometry: BufferGeometry = mesh.geometry
  const posAttr = geometry.getAttribute('position') as BufferAttribute
  if (!posAttr) return []

  const index = geometry.getIndex()
  const triCount = index ? index.count / 3 : posAttr.count / 3

  const box = pyramidBoundingBox(pyramid)
  box.expandByScalar(5)
  const planes = buildPyramidClipPlanes(pyramid)

  if (typeof mesh.updateWorldMatrix === 'function') {
    mesh.updateWorldMatrix(true, false)
  }

  const requireFacing = options?.requireFacing ?? true
  const camPos = new Vector3(cameraPosition.x, cameraPosition.y, cameraPosition.z)
  const visibleFaces: number[] = []

  for (let i = 0; i < triCount; i++) {
    const aIdx = index ? index.getX(i * 3) : i * 3
    const bIdx = index ? index.getX(i * 3 + 1) : i * 3 + 1
    const cIdx = index ? index.getX(i * 3 + 2) : i * 3 + 2

    const a = new Vector3().fromBufferAttribute(posAttr, aIdx).applyMatrix4(mesh.matrixWorld)
    const b = new Vector3().fromBufferAttribute(posAttr, bIdx).applyMatrix4(mesh.matrixWorld)
    const c = new Vector3().fromBufferAttribute(posAttr, cIdx).applyMatrix4(mesh.matrixWorld)

    const centroid = new Vector3().addVectors(a, b).add(c).multiplyScalar(1 / 3)

    // quick reject: triangle AABB must intersect pyramid AABB
    const triBox = new Box3().setFromPoints([a, b, c])
    if (!box.intersectsBox(triBox)) continue

    // fast accept if centroid is inside; otherwise do exact-ish intersection test
    const centroidInside = isPointInsidePyramid(centroid, pyramid)
    if (!centroidInside) {
      if (!triangleIntersectsPyramid(a, b, c, planes)) continue
    }

    if (requireFacing) {
      const normal = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a)).normalize()
      const viewDir = new Vector3().subVectors(camPos, centroid).normalize()
      if (normal.dot(viewDir) < -0.15) continue
    }

    visibleFaces.push(i)
  }

  return visibleFaces
}

/** Flat mesh 格式（与后端 MeshData 一致），用于与后端完全相同的覆盖率计算 */
export type FlatMeshData = { vertices: number[]; indices?: number[] }

/**
 * 在 flat mesh 上计算动态 h（射线与网格最近相交距离），与后端 computeDynamicH 逻辑一致
 */
export function computeDynamicHFromFlatMesh(
  position: { x: number; y: number; z: number },
  direction: { x: number; y: number; z: number },
  meshData: FlatMeshData,
  fallbackH: number,
): number {
  if (!meshData?.vertices?.length) return fallbackH
  const { vertices, indices } = meshData
  const origin = new Vector3(position.x, position.y, position.z)
  const dir = new Vector3(direction.x, direction.y, direction.z)
  if (dir.lengthSq() < 1e-12) return fallbackH
  dir.normalize()

  const triCount = indices && indices.length > 0 ? indices.length / 3 : vertices.length / 9
  let bestT = Infinity
  const RAY_T_EPS = 1e-6

  for (let i = 0; i < triCount; i++) {
    let i1: number, i2: number, i3: number
    if (indices && indices.length > 0) {
      i1 = indices[i * 3]!
      i2 = indices[i * 3 + 1]!
      i3 = indices[i * 3 + 2]!
    } else {
      i1 = i * 3
      i2 = i * 3 + 1
      i3 = i * 3 + 2
    }
    const a = new Vector3(vertices[i1 * 3], vertices[i1 * 3 + 1], vertices[i1 * 3 + 2])
    const b = new Vector3(vertices[i2 * 3], vertices[i2 * 3 + 1], vertices[i2 * 3 + 2])
    const c = new Vector3(vertices[i3 * 3], vertices[i3 * 3 + 1], vertices[i3 * 3 + 2])
    const t = rayTriangleIntersect(origin, dir, a, b, c)
    if (t > RAY_T_EPS && t < bestT) bestT = t
  }
  return Number.isFinite(bestT) ? bestT : fallbackH
}

function rayTriangleIntersect(origin: Vector3, dir: Vector3, v0: Vector3, v1: Vector3, v2: Vector3): number {
  const edge1 = new Vector3().subVectors(v1, v0)
  const edge2 = new Vector3().subVectors(v2, v0)
  const pvec = new Vector3().crossVectors(dir, edge2)
  const det = edge1.dot(pvec)
  if (Math.abs(det) < 1e-12) return Infinity
  const invDet = 1 / det
  const tvec = new Vector3().subVectors(origin, v0)
  const u = tvec.dot(pvec) * invDet
  if (u < 0 || u > 1) return Infinity
  const qvec = new Vector3().crossVectors(tvec, edge1)
  const v = dir.dot(qvec) * invDet
  if (v < 0 || u + v > 1) return Infinity
  const t = edge2.dot(qvec) * invDet
  return t > 0 ? t : Infinity
}

/**
 * 在 flat mesh 上获取四棱锥内可见面，与后端 getVisibleMeshFacesByPyramid 完全一致
 */
export function getVisibleMeshFacesByPyramidFromFlat(
  pyramid: Pyramid,
  meshData: FlatMeshData,
  cameraPosition: { x: number; y: number; z: number },
  options?: { requireFacing?: boolean },
): number[] {
  if (!meshData?.vertices?.length) return []
  const { vertices, indices } = meshData
  const triCount = indices && indices.length > 0 ? indices.length / 3 : vertices.length / 9
  const box = pyramidBoundingBox(pyramid)
  box.expandByScalar(5)
  const planes = buildPyramidClipPlanes(pyramid)
  const camPos = new Vector3(cameraPosition.x, cameraPosition.y, cameraPosition.z)
  const requireFacing = options?.requireFacing ?? true
  const visibleFaces: number[] = []

  for (let i = 0; i < triCount; i++) {
    let i1: number, i2: number, i3: number
    if (indices && indices.length > 0) {
      i1 = indices[i * 3]!
      i2 = indices[i * 3 + 1]!
      i3 = indices[i * 3 + 2]!
    } else {
      i1 = i * 3
      i2 = i * 3 + 1
      i3 = i * 3 + 2
    }
    const a = new Vector3(vertices[i1 * 3], vertices[i1 * 3 + 1], vertices[i1 * 3 + 2])
    const b = new Vector3(vertices[i2 * 3], vertices[i2 * 3 + 1], vertices[i2 * 3 + 2])
    const c = new Vector3(vertices[i3 * 3], vertices[i3 * 3 + 1], vertices[i3 * 3 + 2])
    const triBox = new Box3().setFromPoints([a, b, c])
    if (!box.intersectsBox(triBox)) continue
    const centroid = new Vector3().addVectors(a, b).add(c).multiplyScalar(1 / 3)
    if (!isPointInsidePyramid(centroid, pyramid) && !triangleIntersectsPyramid(a, b, c, planes)) continue
    if (requireFacing) {
      const normal = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a)).normalize()
      const viewDir = new Vector3().subVectors(camPos, centroid).normalize()
      if (normal.dot(viewDir) < -0.15) continue
    }
    visibleFaces.push(i)
  }
  return visibleFaces
}

export function createFrustumGeometry(corners: FrustumCorners): any {
  // 类似Python中的polyhedron_les定义，创建视锥体的边连接关系
  const { near, far } = corners
  
  // 创建顶点数组
  const vertices = [...near, ...far]
  
  // 创建边连接关系（类似Python中的polyhedron_les）
  // 近平面四条边
  const edges = [
    [0, 1], [1, 2], [2, 3], [3, 0],  // 近平面
    [4, 5], [5, 6], [6, 7], [7, 4],  // 远平面
    [0, 4], [1, 5], [2, 6], [3, 7]   // 连接近远平面的边
  ]
  
  // 创建Three.js的BufferGeometry
  const geometry = new BufferGeometry()
  
  // 将顶点转换为Float32Array
  const positionArray = new Float32Array(vertices.length * 3)
  vertices.forEach((vertex, index) => {
    positionArray[index * 3] = vertex.x
    positionArray[index * 3 + 1] = vertex.y
    positionArray[index * 3 + 2] = vertex.z
  })
  
  // 创建边索引
  const indexArray = new Uint16Array(edges.flat())
  
  geometry.setAttribute('position', new BufferAttribute(positionArray, 3))
  geometry.setIndex(new BufferAttribute(indexArray, 1))
  
  return geometry
}

/**
 * 根据normal向量计算相机朝向和上方向
 * 
 * @param normal 相机朝向向量（归一化）
 * @returns 相机朝向向量和上方向向量
 * 
 * 注意：实际数据中normal就是相机朝向向量，可以直接使用
 * 上方向向量需要根据normal计算（通常垂直于normal）
 */
export function calculateCameraOrientationFromNormal(
  normal: { x: number; y: number; z: number }
): {
  direction: { x: number; y: number; z: number }
  up: { x: number; y: number; z: number }
} {
  // normal向量就是相机朝向向量
  const direction = {
    x: normal.x,
    y: normal.y,
    z: normal.z,
  }
  
  // 计算上方向向量（垂直于normal）
  // 如果normal接近垂直（y接近±1），使用Z轴作为参考
  // 否则使用Y轴作为参考
  let up: { x: number; y: number; z: number }
  
  if (Math.abs(normal.y) > 0.9) {
    // normal接近垂直，使用Z轴作为参考
    up = { x: 0, y: 0, z: normal.y > 0 ? -1 : 1 }
  } else {
    // 使用Y轴作为参考，计算垂直于normal的向量
    const yAxis = { x: 0, y: 1, z: 0 }
    // 计算叉积得到垂直于normal和yAxis的向量
    const right = {
      x: normal.y * yAxis.z - normal.z * yAxis.y,
      y: normal.z * yAxis.x - normal.x * yAxis.z,
      z: normal.x * yAxis.y - normal.y * yAxis.x,
    }
    // 归一化right向量
    const rightLen = Math.sqrt(right.x * right.x + right.y * right.y + right.z * right.z)
    if (rightLen > 0.001) {
      up = {
        x: right.x / rightLen,
        y: right.y / rightLen,
        z: right.z / rightLen,
      }
    } else {
      // 如果计算失败，使用默认值
      up = { x: 0, y: 0, z: 1 }
    }
  }
  
  return {
    direction,
    up,
  }
}



/**
 * 根据相机角度计算相机朝向
 *
 * @param position 相机位置（未使用，保留用于接口兼容）
 * @param cameraAngle 相机角度（俯仰角、偏航角、翻滚角）
 * @returns 相机朝向向量和上方向向量
 */
export function calculateCameraOrientationFromAngle(
  cameraAngle: {
    pitch: number  // 俯仰角（度）
    yaw: number    // 偏航角（度）
    roll: number   // 翻滚角（度）
  }
): {
  direction: { x: number; y: number; z: number }
  up: { x: number; y: number; z: number }
} {
  // 将角度转换为弧度
  const pitchRad = (cameraAngle.pitch * Math.PI) / 180
  const yawRad = (cameraAngle.yaw * Math.PI) / 180
  const rollRad = (cameraAngle.roll * Math.PI) / 180
  
  // 计算方向向量
  const direction = {
    x: Math.sin(yawRad) * Math.cos(pitchRad),
    y: -Math.sin(pitchRad),
    z: Math.cos(yawRad) * Math.cos(pitchRad),
  }
  
  // 计算上方向向量（考虑roll）
  // 简化处理：假设上方向垂直于方向向量
  const up = {
    x: Math.sin(yawRad) * Math.sin(pitchRad) * Math.cos(rollRad) - Math.cos(yawRad) * Math.sin(rollRad),
    y: Math.cos(pitchRad) * Math.cos(rollRad),
    z: Math.cos(yawRad) * Math.sin(pitchRad) * Math.cos(rollRad) + Math.sin(yawRad) * Math.sin(rollRad),
  }
  
  return {
    direction,
    up,
  }
}



