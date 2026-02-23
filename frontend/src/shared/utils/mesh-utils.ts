import { Vector3 } from 'three'

/**
 * 提取模型所有 Mesh 的几何数据并合并为单个 MeshData（与后端格式一致）
 */
export function extractAllMeshData(model: any): { vertices: number[]; indices?: number[] } | null {
  if (!model) return null

  const vertices: number[] = []
  const indices: number[] = []
  let vertexOffset = 0

  model.traverse((child: any) => {
    const isMesh = (child as any).isMesh || child.type === 'Mesh' || (child.constructor?.name === 'Mesh')
    if (!isMesh || !child.geometry) return

    const geometry = child.geometry
    const positionAttr = geometry.attributes?.position
    const positions = positionAttr?.array
    if (!positionAttr || !positions || typeof positions.length !== 'number') return

    const vertexCount = positions.length / 3

    if (typeof child.updateWorldMatrix === 'function') {
      child.updateWorldMatrix(true, false)
    }
    const matrix = child.matrixWorld || child.matrix

    for (let i = 0; i < vertexCount; i++) {
      const x = positions[i * 3]
      const y = positions[i * 3 + 1]
      const z = positions[i * 3 + 2]
      if (matrix) {
        const vec = new Vector3(x, y, z)
        vec.applyMatrix4(matrix)
        vertices.push(vec.x, vec.y, vec.z)
      } else {
        vertices.push(x, y, z)
      }
    }

    if (geometry.index) {
      const indexArray = geometry.index?.array
      if (indexArray && typeof indexArray.length === 'number') {
        for (let i = 0; i < indexArray.length; i++) {
          indices.push(vertexOffset + (indexArray[i] ?? 0))
        }
      } else {
        for (let i = 0; i < vertexCount; i++) {
          indices.push(vertexOffset + i)
        }
      }
    } else {
      for (let i = 0; i < vertexCount; i++) {
        indices.push(vertexOffset + i)
      }
    }
    vertexOffset += vertexCount
  })

  if (vertices.length === 0) return null
  return {
    vertices,
    indices: indices.length > 0 ? indices : undefined,
  }
}

/** 从面索引计算覆盖率：coveredArea / totalArea * 100。meshData 为合并后的顶点+索引 */
export function computeCoverageFromFaceIndices(
  meshData: { vertices: number[]; indices?: number[] },
  coveredFaceIndices: number[],
): number {
  const { vertices, indices } = meshData
  if (!vertices || vertices.length < 9) return 0

  const getVertex = (i: number) => ({
    x: vertices[i * 3],
    y: vertices[i * 3 + 1],
    z: vertices[i * 3 + 2],
  })

  const faceArea = (faceIdx: number): number => {
    const idx = indices && indices.length > 0 ? indices : null
    const i0 = idx ? idx[faceIdx * 3]! : faceIdx * 3
    const i1 = idx ? idx[faceIdx * 3 + 1]! : faceIdx * 3 + 1
    const i2 = idx ? idx[faceIdx * 3 + 2]! : faceIdx * 3 + 2
    const v0 = getVertex(i0)
    const v1 = getVertex(i1)
    const v2 = getVertex(i2)
    const ax = v1.x - v0.x
    const ay = v1.y - v0.y
    const az = v1.z - v0.z
    const bx = v2.x - v0.x
    const by = v2.y - v0.y
    const bz = v2.z - v0.z
    const cx = ay * bz - az * by
    const cy = az * bx - ax * bz
    const cz = ax * by - ay * bx
    const area = 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz)
    return Number.isFinite(area) ? area : 0
  }

  const faceCount = indices ? indices.length / 3 : vertices.length / 9
  let totalArea = 0
  for (let i = 0; i < faceCount; i++) totalArea += faceArea(i)

  const coveredSet = new Set(coveredFaceIndices)
  let coveredArea = 0
  const faceCountMax = indices ? indices.length / 3 : vertices.length / 9
  for (const i of coveredSet) {
    if (i >= 0 && i < faceCountMax && Number.isFinite(i)) coveredArea += faceArea(i)
  }

  const pct = totalArea > 0 ? (coveredArea / totalArea) * 100 : 0
  return Number.isFinite(pct) ? pct : 0
}
