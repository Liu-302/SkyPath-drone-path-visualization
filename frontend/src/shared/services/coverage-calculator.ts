/**
 * 前端覆盖率计算服务
 * 与后端 CoverageCalculatorService 使用完全相同的算法：flat mesh + 四棱锥 + 动态 h + 航点 normal
 * 保证与 KPI 面板的 Coverage Rate 一致
 */

import {
  buildPyramidFromCamera,
  computeDynamicHFromFlatMesh,
  getVisibleMeshFacesByPyramidFromFlat,
  vfovToHfov,
} from '@/shared/utils/camera-utils'
import { COVERAGE_CONFIG } from '@/shared/constants/constants'
import { extractAllMeshData, computeCoverageFromFaceIndices } from '@/shared/utils/mesh-utils'

export type PathPoint = {
  x: number
  y: number
  z: number
  normal?: { x: number; y: number; z: number }
}

function getDirectionFromPoint(
  point: PathPoint,
  buildingCenter: { x: number; y: number; z: number },
  cameraPosition: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
  const n = point.normal
  if (n) {
    const len = Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z)
    if (len > 1e-6) {
      return { x: n.x / len, y: n.y / len, z: n.z / len }
    }
  }
  const dx = buildingCenter.x - cameraPosition.x
  const dy = buildingCenter.y - cameraPosition.y
  const dz = buildingCenter.z - cameraPosition.z
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz)
  if (len < 1e-6) return { x: 0, y: -1, z: 0 }
  return { x: dx / len, y: dy / len, z: dz / len }
}

/** 提取建筑中心（用于 normal 缺失时的兜底方向） */
function extractMeshCenter(vertices: number[]): { x: number; y: number; z: number } {
  const n = vertices.length / 3
  let cx = 0, cy = 0, cz = 0
  for (let i = 0; i < n; i++) {
    cx += vertices[i * 3]
    cy += vertices[i * 3 + 1]
    cz += vertices[i * 3 + 2]
  }
  return { x: cx / n, y: cy / n, z: cz / n }
}

/**
 * 前端计算路径累计覆盖率（与后端 CoverageCalculatorService 完全一致：flat mesh + 四棱锥 + 动态 h）
 * @param pathPoints 前 N 个航点（0..waypointCount-1）
 * @param buildingModel Three.js 建筑模型（Group 或 Mesh）
 * @returns 覆盖率 0–100，或 null（无法计算时）
 */
export function calculatePathCoverageFrontend(
  pathPoints: PathPoint[],
  buildingModel: any,
): number | null {
  if (!pathPoints.length || !buildingModel) return null
  if (pathPoints.length < 2) return 0

  const meshData = extractAllMeshData(buildingModel)
  if (!meshData || meshData.vertices.length < 9) return null

  const buildingCenter = extractMeshCenter(meshData.vertices)
  const vfovDeg = COVERAGE_CONFIG.vfov
  const hfovDeg = vfovToHfov(vfovDeg, COVERAGE_CONFIG.aspect)
  const fallbackH = COVERAGE_CONFIG.fallbackH

  const coveredFaces = new Set<number>()
  const flatMesh = {
    vertices: meshData.vertices,
    indices: meshData.indices && meshData.indices.length > 0 ? meshData.indices : undefined,
  }

  for (const point of pathPoints) {
    const position = { x: point.x, y: point.y, z: point.z }
    const direction = getDirectionFromPoint(point, buildingCenter, position)
    const h = computeDynamicHFromFlatMesh(position, direction, flatMesh, fallbackH)
    const pyramid = buildPyramidFromCamera(position, direction, vfovDeg, hfovDeg, h)
    const faces = getVisibleMeshFacesByPyramidFromFlat(pyramid, flatMesh, position, { requireFacing: true })
    faces.forEach((f) => coveredFaces.add(f))
  }

  const coverage = computeCoverageFromFaceIndices(meshData, Array.from(coveredFaces))
  return Number.isFinite(coverage) ? Math.max(0, Math.min(100, coverage)) : null
}

/**
 * 单航点可见面（用于增量预加载，避免 O(N²) 重算）
 * @returns 该视点可见的面索引数组
 */
export function computeVisibleFacesForPoint(
  point: PathPoint,
  flatMesh: { vertices: number[]; indices?: number[] },
  buildingCenter: { x: number; y: number; z: number },
): number[] {
  const position = { x: point.x, y: point.y, z: point.z }
  const direction = getDirectionFromPoint(point, buildingCenter, position)
  const vfovDeg = COVERAGE_CONFIG.vfov
  const hfovDeg = vfovToHfov(vfovDeg, COVERAGE_CONFIG.aspect)
  const fallbackH = COVERAGE_CONFIG.fallbackH
  const h = computeDynamicHFromFlatMesh(position, direction, flatMesh, fallbackH)
  const pyramid = buildPyramidFromCamera(position, direction, vfovDeg, hfovDeg, h)
  return getVisibleMeshFacesByPyramidFromFlat(pyramid, flatMesh, position, { requireFacing: true })
}
