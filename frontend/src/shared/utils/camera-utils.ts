/**
 * 相机和视锥体计算工具
 * 
 * 文件作用：
 * - 提供相机视锥体计算函数
 * - 计算视锥体角点、投影、可见面等
 */

import type { CameraView, FrustumCorners } from '@/features/visualization/types/camera'
import { Vector3, BufferGeometry, BufferAttribute, Box3 } from 'three'

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

/**
 * 将视锥体投影到平面
 * 基于FURP的射线-平面相交算法思想实现
 * 
 * @param frustum 视锥体角点
 * @param plane 平面（点和法线）
 * @returns 投影后的多边形顶点数组
 * 
 * 实现思路：类似FURP中的射线与三角形相交检测
 * 将视锥体射线与平面相交，计算投影点
 */
export function projectFrustumToPlane(
  frustum: FrustumCorners,
  plane: {
    point: { x: number; y: number; z: number }
    normal: { x: number; y: number; z: number }
  }
): Array<{ x: number; y: number; z: number }> {
  // Estimate camera position from frustum
  const camPos = estimateCameraPositionFromFrustum(frustum)

  const planePoint = new Vector3(plane.point.x, plane.point.y, plane.point.z)
  const planeNormal = new Vector3(plane.normal.x, plane.normal.y, plane.normal.z).normalize()

  const pts3d: Vector3[] = []
  const corners = [...frustum.near, ...frustum.far]
  for (const c of corners) {
    const corner = new Vector3(c.x, c.y, c.z)
    const dir = new Vector3().subVectors(corner, camPos)
    const denom = planeNormal.dot(dir)
    if (Math.abs(denom) < 1e-6) continue // 平行，忽略
    const t = planeNormal.dot(new Vector3().subVectors(planePoint, camPos)) / denom
    if (t < 0) continue
    const inter = new Vector3().copy(camPos).addScaledVector(dir, t)
    pts3d.push(inter)
  }

  if (pts3d.length === 0) return []

  // Build orthonormal basis on plane
  let u = new Vector3()
  // pick arbitrary vector not parallel to normal
  if (Math.abs(planeNormal.x) < 0.9) u.set(1, 0, 0)
  else u.set(0, 0, 1)
  u.cross(planeNormal).normalize()
  const v = new Vector3().crossVectors(planeNormal, u).normalize()

  // project to 2D coordinates
  const pts2d: Array<{ x: number; y: number; p3: Vector3 }> = pts3d.map(p => {
    const rel = new Vector3().subVectors(p, planePoint)
    return { x: rel.dot(u), y: rel.dot(v), p3: p }
  })

  // compute 2D convex hull (Monotone chain)
  pts2d.sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x))
  function cross(o: any, a: any, b: any) {
    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
  }
  const lower: typeof pts2d = []
  for (const p of pts2d) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop()
    lower.push(p)
  }
  const upper: typeof pts2d = []
  for (let i = pts2d.length - 1; i >= 0; i--) {
    const p = pts2d[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop()
    upper.push(p)
  }
  const hull2d = lower.slice(0, lower.length - 1).concat(upper.slice(0, upper.length - 1))

  // map back to 3D
  const hull3d = hull2d.map(h => h.p3).map(v3 => ({ x: v3.x, y: v3.y, z: v3.z }))
  return hull3d
}

/**
 * 计算视锥体在地面上的投影
 * 用于计算覆盖面积
 * 
 * @param frustum 视锥体角点
 * @param groundPlane 地面平面定义（默认Y=0平面）
 * @returns 投影多边形顶点（按顺序排列，用于计算面积）
 * 
 * 成员A定义接口，成员C/D实现
 * 用于覆盖率计算中的覆盖面积计算
 */
export function projectFrustumToGround(
  frustum: FrustumCorners,
  groundPlane?: {
    point: { x: number; y: number; z: number }
    normal: { x: number; y: number; z: number }
  }
): Array<{ x: number; y: number; z: number }> {
  // 如果没有指定地面平面，使用默认的Y=0平面
  const plane = groundPlane || {
    point: { x: 0, y: 0, z: 0 },
    normal: { x: 0, y: 1, z: 0 }, // Y轴向上
  }
  
  // 使用通用的平面投影实现（基于FURP的投影思想）
  return projectFrustumToPlane(frustum, plane)
}

/**
 * 计算视锥体与建筑物的相交区域
 * 用于覆盖率计算
 * 
 * @param frustum 视锥体角点
 * @param buildingMesh 建筑物网格（Three.js Mesh）
 * @returns 相交区域信息
 * 
 * 成员A定义接口，成员C/D实现
 * 用于计算每个视点拍摄到的建筑物区域
 */
export function calculateFrustumBuildingIntersection(
  frustum: FrustumCorners,
  buildingMesh: any
): {
  visibleFaces: number[]      // 可见面的索引数组
  coverageArea: number          // 覆盖面积（平方米）
  intersectionPoints: Array<{ x: number; y: number; z: number }>  // 相交点（可选）
} {
  // 使用 getVisibleMeshFaces 获取可见面的索引，然后计算这些面的总面积和质心作为相交点列表
  const visible = getVisibleMeshFaces(frustum, buildingMesh)
  const geometry: BufferGeometry = buildingMesh.geometry
  const posAttr = geometry.getAttribute('position') as BufferAttribute
  const index = geometry.getIndex()

  let coverageArea = 0
  const intersectionPoints: Array<{ x: number; y: number; z: number }> = []

  for (const fi of visible) {
    const aIdx = index ? index.getX(fi * 3) : fi * 3
    const bIdx = index ? index.getX(fi * 3 + 1) : fi * 3 + 1
    const cIdx = index ? index.getX(fi * 3 + 2) : fi * 3 + 2

    const a = new Vector3().fromBufferAttribute(posAttr, aIdx).applyMatrix4(buildingMesh.matrixWorld)
    const b = new Vector3().fromBufferAttribute(posAttr, bIdx).applyMatrix4(buildingMesh.matrixWorld)
    const c = new Vector3().fromBufferAttribute(posAttr, cIdx).applyMatrix4(buildingMesh.matrixWorld)

    const area = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a)).length() * 0.5
    coverageArea += area

    const centroid = new Vector3().addVectors(a, b).add(c).multiplyScalar(1 / 3)
    intersectionPoints.push({ x: centroid.x, y: centroid.y, z: centroid.z })
  }

  return {
    visibleFaces: visible,
    coverageArea,
    intersectionPoints,
  }
}

/**
 * 判断视锥体是否与网格相交
 * 
 * @param frustum 视锥体角点
 * @param mesh Three.js网格对象
 * @returns 是否相交
 * 
 * 成员A定义接口，成员C/D实现
 * 用于碰撞检测
 */
export function frustumIntersectsMesh(frustum: FrustumCorners, mesh: any): boolean {
  if (!mesh) return false
  try {
    // 先进行快速的边界框检测
    const boxF = new Box3()
    const corners = [...frustum.near, ...frustum.far]
    corners.forEach(c => boxF.expandByPoint(new Vector3(c.x, c.y, c.z)))

    const boxM = new Box3().setFromObject(mesh)
    if (!boxF.intersectsBox(boxM)) return false
    
    // 如果边界框相交，再进行精确的可见面检测
    const visibleFaces = getVisibleMeshFaces(frustum, mesh)
    return visibleFaces.length > 0
  } catch (e) {
    return false
  }
}

/**
 * 获取视锥体内可见的网格面
 * 
 * @param frustum 视锥体角点
 * @param mesh Three.js网格对象
 * @param cameraPosition 相机位置（世界坐标，可选，如果未提供则自动估算）
 * @returns 可见面的索引数组
 * 
 * 成员A定义接口，成员C/D实现
 * 用于覆盖率计算和建筑物高亮
 * 
 * 实现思路：基于Python代码中的视锥体检测原理
 * 1. 获取建筑物的所有面
 * 2. 计算每个面的中心点
 * 3. 检测中心点是否在视锥体内
 * 4. 返回可见面的索引
 */
export function getVisibleMeshFaces(
  frustum: FrustumCorners,
  mesh: any,
  cameraPosition?: { x: number; y: number; z: number }
): number[] {
  if (!mesh || !mesh.geometry) return []

  const geometry: BufferGeometry = mesh.geometry
  const posAttr = geometry.getAttribute('position') as BufferAttribute
  if (!posAttr) return []

  const index = geometry.getIndex()
  const triCount = index ? index.count / 3 : posAttr.count / 3


  // conservative bounding box test first
  const boxF = new Box3()
  const corners = [...frustum.near, ...frustum.far]
  corners.forEach(c => boxF.expandByPoint(new Vector3(c.x, c.y, c.z)))
  // 扩大一点包围盒，避免浮点误差导致的“线框覆盖但未被判定”现象
  boxF.expandByScalar(0.5)

  const camPos = cameraPosition
    ? new Vector3(cameraPosition.x, cameraPosition.y, cameraPosition.z)
    : estimateCameraPositionFromFrustum(frustum)
  const frustumBasis = buildFrustumBasis(frustum, camPos)

  const visibleFaces: number[] = []

  if (typeof mesh.updateWorldMatrix === 'function') {
    mesh.updateWorldMatrix(true, false)
  }

  for (let i = 0; i < triCount; i++) {
    const aIdx = index ? index.getX(i * 3) : i * 3
    const bIdx = index ? index.getX(i * 3 + 1) : i * 3 + 1
    const cIdx = index ? index.getX(i * 3 + 2) : i * 3 + 2

    const a = new Vector3().fromBufferAttribute(posAttr, aIdx).applyMatrix4(mesh.matrixWorld)
    const b = new Vector3().fromBufferAttribute(posAttr, bIdx).applyMatrix4(mesh.matrixWorld)
    const c = new Vector3().fromBufferAttribute(posAttr, cIdx).applyMatrix4(mesh.matrixWorld)

    const centroid = new Vector3().addVectors(a, b).add(c).multiplyScalar(1 / 3)

    if (!boxF.containsPoint(centroid)) continue

    if (!isPointInsideFrustumBasis(centroid, frustumBasis)) continue

    // face normal
    const normal = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a)).normalize()

    // if face roughly faces the camera (dot >= 0) then consider visible
    const viewDir = new Vector3().subVectors(camPos, centroid).normalize()
    const facing = normal.dot(viewDir) >= 0
    if (!facing) continue

    // Accept face as visible (conservative)
    visibleFaces.push(i)
  }

  return visibleFaces
}

interface FrustumBasis {
  camPos: Vector3
  forward: Vector3
  right: Vector3
  up: Vector3
  nearDist: number
  farDist: number
  tanVertical: number
  tanHorizontal: number
}

function buildFrustumBasis(frustum: FrustumCorners, camPos: Vector3): FrustumBasis {
  const nearPts = frustum.near.map(p => new Vector3(p.x, p.y, p.z))
  const nearCenter = averageVectors(nearPts)
  const farCenter = averageVectors(frustum.far.map(p => new Vector3(p.x, p.y, p.z)))

  const forward = new Vector3().subVectors(nearCenter, camPos).normalize()
  const nearDist = Math.max(nearCenter.distanceTo(camPos), 1e-3)
  const farDist = Math.max(farCenter.distanceTo(camPos), nearDist + 1e-3)

  const rawRight = new Vector3().subVectors(nearPts[1], nearPts[0]).normalize()
  const right = new Vector3().subVectors(rawRight, forward.clone().multiplyScalar(rawRight.dot(forward))).normalize()
  const rawUp = new Vector3().subVectors(nearPts[3], nearPts[0]).normalize()
  const up = new Vector3().subVectors(rawUp, forward.clone().multiplyScalar(rawUp.dot(forward))).normalize()

  const nearHalfWidth = new Vector3().subVectors(nearPts[1], nearPts[0]).length() * 0.5
  const nearHalfHeight = new Vector3().subVectors(nearPts[3], nearPts[0]).length() * 0.5

  const tanHorizontal = nearHalfWidth / nearDist
  const tanVertical = nearHalfHeight / nearDist

  return { camPos: camPos.clone(), forward, right, up, nearDist, farDist, tanVertical, tanHorizontal }
}

function averageVectors(vectors: Vector3[]): Vector3 {
  const sum = new Vector3()
  for (const v of vectors) sum.add(v)
  return sum.multiplyScalar(1 / vectors.length)
}

function isPointInsideFrustumBasis(point: Vector3, basis: FrustumBasis): boolean {
  const { camPos, forward, right, up, nearDist, farDist, tanVertical, tanHorizontal } = basis
  const rel = new Vector3().subVectors(point, camPos)
  const forwardLen = rel.dot(forward)
  // 增加与距离相关的容差，确保与视锥体线框一致
  const distanceSlack = Math.max(0.5, forwardLen * 0.02)
  if (forwardLen < nearDist - distanceSlack || forwardLen > farDist + distanceSlack) return false

  const verticalOffset = rel.dot(up)
  const horizontalOffset = rel.dot(right)
  const maxVertical = forwardLen * tanVertical + distanceSlack
  const maxHorizontal = forwardLen * tanHorizontal + distanceSlack

  if (Math.abs(verticalOffset) > maxVertical) return false
  if (Math.abs(horizontalOffset) > maxHorizontal) return false

  return true
}




/**
 * 计算三角形面积（基于FURP的几何计算思想）
 */
function calculateTriangleArea(v1: Vector3, v2: Vector3, v3: Vector3): number {
  const edge1 = new Vector3().subVectors(v2, v1)
  const edge2 = new Vector3().subVectors(v3, v1)
  const crossProduct = new Vector3().crossVectors(edge1, edge2)
  return crossProduct.length() / 2
}

/**
 * 计算建筑物总面积
 */
export function calculateTotalBuildingArea(mesh: any): number {
  if (!mesh || !mesh.geometry) return 0
  
  const geometry = mesh.geometry
  const positions = geometry.attributes.position.array
  const index = geometry.index ? geometry.index.array : null
  
  let totalArea = 0
  
  if (index) {
    // 有索引的三角形网格
    const faceCount = index.length / 3
    for (let faceIndex = 0; faceIndex < faceCount; faceIndex++) {
      const i1 = index[faceIndex * 3]
      const i2 = index[faceIndex * 3 + 1]
      const i3 = index[faceIndex * 3 + 2]
      
      const v1 = new Vector3(positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2])
      const v2 = new Vector3(positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2])
      const v3 = new Vector3(positions[i3 * 3], positions[i3 * 3 + 1], positions[i3 * 3 + 2])
      
      totalArea += calculateTriangleArea(v1, v2, v3)
    }
  } else {
    // 无索引的三角形列表
    const faceCount = positions.length / 9
    for (let faceIndex = 0; faceIndex < faceCount; faceIndex++) {
      const v1 = new Vector3(positions[faceIndex * 9], positions[faceIndex * 9 + 1], positions[faceIndex * 9 + 2])
      const v2 = new Vector3(positions[faceIndex * 9 + 3], positions[faceIndex * 9 + 4], positions[faceIndex * 9 + 5])
      const v3 = new Vector3(positions[faceIndex * 9 + 6], positions[faceIndex * 9 + 7], positions[faceIndex * 9 + 8])
      
      totalArea += calculateTriangleArea(v1, v2, v3)
    }
  }
  
  return totalArea
}

/**
 * 计算重叠率（基于您要求的科学算法）
 * 
 * @param coverageAreas 各视点的覆盖面积
 * @param buildingMesh 建筑物网格
 * @param viewpoints 视点数据
 * @returns 重叠率百分比
 * 
 * 实现思路：
 * 1. 收集所有视点的可见面集合
 * 2. 计算每个面的覆盖次数
 * 3. 整体重叠率 = 被覆盖2次及以上的面积 / 建筑物总面积
 * 4. 单个视点重叠率 = (当前视点与历史视点交集的面积) / 建筑物总面积
 */
function calculateOverlapRate(
  coverageAreas: number[],
  buildingMesh: any,
  viewpoints: any[]
): number {
  if (viewpoints.length <= 1) return 0
  
  const totalArea = calculateTotalBuildingArea(buildingMesh)
  if (totalArea <= 0) return 0
  
  // 1. 收集所有视点的可见面
  const faceCoverageMap = new Map<number, number>() // 面索引 -> 覆盖次数
  
  // 遍历所有视点，统计每个面的覆盖次数
  for (const viewpoint of viewpoints) {
    try {
      const frustum = calculateFrustumCorners(
        viewpoint.position,
        viewpoint.direction || { x: 0, y: -1, z: 0 },
        { x: 0, y: 1, z: 0 },
        viewpoint.fov || 60,
        viewpoint.aspect || 16/9,
        viewpoint.near || 1,
        viewpoint.far || 1000
      )
      
      const visibleFaces = getVisibleMeshFaces(frustum, buildingMesh)
      
      // 统计每个面的覆盖次数
      for (const faceIndex of visibleFaces) {
        faceCoverageMap.set(faceIndex, (faceCoverageMap.get(faceIndex) || 0) + 1)
      }
    } catch (error) {
      console.warn('计算视点可见面时出错:', error)
    }
  }
  
  // 2. 计算被覆盖2次及以上的面积
  let overlapArea = 0
  
  for (const [faceIndex, coverageCount] of faceCoverageMap.entries()) {
    if (coverageCount >= 2) {
      // 计算这个面的面积
      const faceArea = calculateFaceArea(buildingMesh, faceIndex)
      overlapArea += faceArea
    }
  }
  
  // 3. 整体重叠率 = 被覆盖2次及以上的面积 / 建筑物总面积
  const overallOverlapRate = (overlapArea / totalArea) * 100
  
  return overallOverlapRate
}

/**
 * 计算覆盖率和重叠率的核心函数
 * 基于FURP的碰撞检测矩阵思想实现
 * 
 * @param viewpoints 所有视点数据
 * @param buildingMesh 建筑物网格
 * @returns 覆盖率和重叠率百分比
 * 
 * 实现思路：
 * 1. 计算每个视点的投影面积
 * 2. 计算总覆盖面积
 * 3. 计算重叠面积
 * 4. 返回覆盖率和重叠率
 */
export function calculateCoverageMetrics(
  viewpoints: CameraView[],
  buildingMesh: any
): { coverage: number; overlap: number } {
  // 类似FURP中的碰撞矩阵思想，计算覆盖面积
  const totalArea = calculateTotalBuildingArea(buildingMesh)
  let coveredArea = 0
  
  // 计算每个视点的覆盖区域
  const coverageAreas: number[] = []
  
  for (const viewpoint of viewpoints) {
    // 计算视锥体
    const frustum = calculateFrustumCorners(
      viewpoint.position,
      viewpoint.direction || { x: 0, y: -1, z: 0 },
      { x: 0, y: 1, z: 0 }, // 上方向
      viewpoint.fov || 60,
      viewpoint.aspect || 16/9,
      viewpoint.near || 1,
      viewpoint.far || 1000
    )
    
    // 计算相交面积
    const intersection = calculateFrustumBuildingIntersection(frustum, buildingMesh)
    coverageAreas.push(intersection.coverageArea)
  }
  
  // 计算总覆盖面积（使用集合覆盖思想，避免重复计算）
  // 简化处理：取最大值作为覆盖面积
  coveredArea = Math.max(...coverageAreas)
  
  // 计算重叠率：覆盖率占建筑物总面积的比例
  const coverage = totalArea > 0 ? (coveredArea / totalArea) * 100 : 0
  
  // 重叠率：基于FURP的科学计算，考虑多边形交集面积
  const overlap = viewpoints.length > 1 ? calculateOverlapRate(coverageAreas, buildingMesh, viewpoints) : 0
  
  return {
    coverage: Math.min(coverage, 100), // 覆盖率不超过100%
    overlap: Math.min(overlap, 100)   // 重叠率不超过100%
  }
}

/**
 * 计算单个面的面积
 */
export function calculateFaceArea(mesh: any, faceIndex: number): number {
  if (!mesh || !mesh.geometry) return 0
  
  const geometry = mesh.geometry
  const positions = geometry.attributes.position.array
  const index = geometry.index ? geometry.index.array : null
  
  if (index) {
    // 有索引的三角形网格
    const i1 = index[faceIndex * 3]
    const i2 = index[faceIndex * 3 + 1]
    const i3 = index[faceIndex * 3 + 2]
    
    const v1 = new Vector3(positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2])
    const v2 = new Vector3(positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2])
    const v3 = new Vector3(positions[i3 * 3], positions[i3 * 3 + 1], positions[i3 * 3 + 2])
    
    return calculateTriangleArea(v1, v2, v3)
  } else {
    // 无索引的三角形列表
    const v1 = new Vector3(positions[faceIndex * 9], positions[faceIndex * 9 + 1], positions[faceIndex * 9 + 2])
    const v2 = new Vector3(positions[faceIndex * 9 + 3], positions[faceIndex * 9 + 4], positions[faceIndex * 9 + 5])
    const v3 = new Vector3(positions[faceIndex * 9 + 6], positions[faceIndex * 9 + 7], positions[faceIndex * 9 + 8])
    
    return calculateTriangleArea(v1, v2, v3)
  }
}

/**
 * 计算单个视点的重叠率
 * 单个视点重叠率 = (当前视点与历史视点交集的面积) / 建筑物总面积
 * 
 * @param viewpointIndex 当前视点索引
 * @param viewpoints 所有视点数据
 * @param buildingMesh 建筑物网格
 * @returns 单个视点重叠率百分比
 */
export function calculateSingleViewpointOverlapRate(
  viewpointIndex: number,
  viewpoints: any[],
  buildingMesh: any
): number {
  if (viewpointIndex < 1 || viewpointIndex >= viewpoints.length) return 0
  
  const totalArea = calculateTotalBuildingArea(buildingMesh)
  if (totalArea <= 0) return 0
  
  const currentViewpoint = viewpoints[viewpointIndex]
  
  // 计算当前视点的可见面
  const currentFrustum = calculateFrustumCorners(
    currentViewpoint.position,
    currentViewpoint.direction || { x: 0, y: -1, z: 0 },
    { x: 0, y: 1, z: 0 },
    currentViewpoint.fov || 60,
    currentViewpoint.aspect || 16/9,
    currentViewpoint.near || 1,
    currentViewpoint.far || 1000
  )
  
  const currentVisibleFaces = new Set(getVisibleMeshFaces(currentFrustum, buildingMesh))
  
  // 计算历史视点的并集可见面
  const historicalVisibleFaces = new Set<number>()
  for (let j = 0; j < viewpointIndex; j++) {
    const historicalViewpoint = viewpoints[j]
    const historicalFrustum = calculateFrustumCorners(
      historicalViewpoint.position,
      historicalViewpoint.direction || { x: 0, y: -1, z: 0 },
      { x: 0, y: 1, z: 0 },
      historicalViewpoint.fov || 60,
      historicalViewpoint.aspect || 16/9,
      historicalViewpoint.near || 1,
      historicalViewpoint.far || 1000
    )
    
    const historicalFaces = getVisibleMeshFaces(historicalFrustum, buildingMesh)
    historicalFaces.forEach(face => historicalVisibleFaces.add(face))
  }
  
  // 计算交集面积
  let intersectionArea = 0
  for (const faceIndex of currentVisibleFaces) {
    if (historicalVisibleFaces.has(faceIndex)) {
      intersectionArea += calculateFaceArea(buildingMesh, faceIndex)
    }
  }
  
  // 单个视点重叠率 = 交集面积 / 建筑物总面积
  return (intersectionArea / totalArea) * 100
}

/**
 * 创建视锥体几何体（用于可视化）
 * 
 * @param corners 视锥体角点
 * @returns Three.js几何体对象（BufferGeometry）
 * 
 * 基于Python文件中多面体连线的思路，创建视锥体线框几何体
 */
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
 * 根据相机角度计算相机朝向（用于兼容，如果后续需要从角度计算）
 * 
 * @param position 相机位置（未使用，保留用于接口兼容）
 * @param cameraAngle 相机角度（俯仰角、偏航角、翻滚角）
 * @returns 相机朝向向量和上方向向量
 * 
 * TODO: 成员C/D可以实现这个函数，用于从角度计算朝向（如果需要）
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



