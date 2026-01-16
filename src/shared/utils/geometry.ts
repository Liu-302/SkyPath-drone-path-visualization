/**
 * 几何计算工具函数
 * 
 * 文件作用：
 * - 提供基础的几何计算函数
 * - 包括距离计算、向量操作等基础函数
 * - 为camera-utils.ts提供基础支持
 */

/**
 * 计算两点之间的3D距离
 * 
 * @param p1 第一个点
 * @param p2 第二个点
 * @returns 两点之间的距离（米）
 */
export function distance3D(
  p1: { x: number; y: number; z: number },
  p2: { x: number; y: number; z: number }
): number {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const dz = p2.z - p1.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

/**
 * 计算路径总长度
 * 
 * @param pathPoints 路径点数组
 * @returns 路径总长度（米）
 */
export function calculatePathLength(
  pathPoints: Array<{ x: number; y: number; z: number }>
): number {
  if (pathPoints.length < 2) return 0
  
  let totalDistance = 0
  for (let i = 1; i < pathPoints.length; i++) {
    totalDistance += distance3D(pathPoints[i - 1], pathPoints[i])
  }
  
  return totalDistance
}

/**
 * 向量点积
 * 
 * @param v1 第一个向量
 * @param v2 第二个向量
 * @returns 点积结果
 */
export function dotProduct(
  v1: { x: number; y: number; z: number },
  v2: { x: number; y: number; z: number }
): number {
  return v1.x * v2.x + v1.y * v2.y + v1.z * v2.z
}

/**
 * 向量叉积
 * 
 * @param v1 第一个向量
 * @param v2 第二个向量
 * @returns 叉积结果向量
 */
export function crossProduct(
  v1: { x: number; y: number; z: number },
  v2: { x: number; y: number; z: number }
): { x: number; y: number; z: number } {
  return {
    x: v1.y * v2.z - v1.z * v2.y,
    y: v1.z * v2.x - v1.x * v2.z,
    z: v1.x * v2.y - v1.y * v2.x
  }
}

/**
 * 向量长度
 * 
 * @param v 向量
 * @returns 向量长度
 */
export function vectorLength(v: { x: number; y: number; z: number }): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
}

/**
 * 向量归一化
 * 
 * @param v 向量
 * @returns 归一化后的向量
 */
export function normalizeVector(v: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
  const len = vectorLength(v)
  if (len === 0) return { x: 0, y: 0, z: 0 }
  return {
    x: v.x / len,
    y: v.y / len,
    z: v.z / len
  }
}

/**
 * 计算点到平面的距离
 * 
 * @param point 点坐标
 * @param plane 平面定义（点+法线）
 * @returns 点到平面的距离
 */
export function distanceToPlane(
  point: { x: number; y: number; z: number },
  plane: { point: { x: number; y: number; z: number }; normal: { x: number; y: number; z: number } }
): number {
  const v = {
    x: point.x - plane.point.x,
    y: point.y - plane.point.y,
    z: point.z - plane.point.z
  }
  return Math.abs(dotProduct(v, plane.normal)) / vectorLength(plane.normal)
}

/**
 * 计算三角形面积
 * 
 * @param p1 第一个顶点
 * @param p2 第二个顶点
 * @param p3 第三个顶点
 * @returns 三角形面积
 */
export function triangleArea(
  p1: { x: number; y: number; z: number },
  p2: { x: number; y: number; z: number },
  p3: { x: number; y: number; z: number }
): number {
  const v1 = { x: p2.x - p1.x, y: p2.y - p1.y, z: p2.z - p1.z }
  const v2 = { x: p3.x - p1.x, y: p3.y - p1.y, z: p3.z - p1.z }
  const cross = crossProduct(v1, v2)
  return vectorLength(cross) / 2
}

/**
 * 计算多边形面积（投影到XY平面）
 * 
 * @param vertices 多边形顶点数组
 * @returns 多边形面积
 */
export function polygonAreaXY(vertices: Array<{ x: number; y: number; z: number }>): number {
  if (vertices.length < 3) return 0
  
  let area = 0
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length
    area += vertices[i].x * vertices[j].y - vertices[j].x * vertices[i].y
  }
  
  return Math.abs(area) / 2
}

/**
 * 检查点是否在多边形内（投影到XY平面）
 * 
 * @param point 要检查的点
 * @param polygon 多边形顶点数组
 * @returns 是否在多边形内
 */
export function isPointInPolygonXY(
  point: { x: number; y: number; z: number },
  polygon: Array<{ x: number; y: number; z: number }>
): boolean {
  // TODO: 成员A需要实现点是否在多边形内的检查
  // 使用射线法或其他算法
  return false
}