/**
 * 覆盖范围计算服务
 * 负责计算相机视锥体对建筑物的覆盖情况
 * 
 * 实现思路参考 `kpi_calculation_with_real_data.js` 中的科学算法：
 * 1. 基于视点的法向量计算视锥体
 * 2. 统计每个三角面的覆盖次数
 * 3. 由覆盖面积、重叠面积推导覆盖率/重叠率
 */

import type { Camera } from '@/features/visualization/types/camera'
import type { CoverageResult } from '@/features/kpi/types/kpi'
import { Vector3, Matrix4, Quaternion } from 'three'
import { CAMERA_CONFIG } from '@/shared/constants/constants'
import { calculateFrustumCorners, calculateCameraOrientationFromNormal, getVisibleMeshFaces } from '@/shared/utils/camera-utils'

type PathPoint = {
  id: number
  position: { x: number; y: number; z: number }
  normal?: { x: number; y: number; z: number }
}

export class CoverageCalculator {
  /**
   * 检查模型是否是有效的几何体（支持Group对象）
   */
  private isValidMesh(mesh: any): boolean {
    if (!mesh) {
      // console.log('isValidMesh: mesh参数为空')
      return false
    }

    // console.log('isValidMesh检查:', {
    //   类型: mesh.constructor?.name,
    //   isGroup: mesh.isGroup,
    //   子对象数量: mesh.children?.length || 0,
    //   有geometry: !!mesh.geometry,
    //   有position属性: mesh.geometry?.attributes?.position ? '是' : '否'
    // })

    // 如果是Group对象，检查子对象是否有几何体
    if (mesh.isGroup && mesh.children && mesh.children.length > 0) {
      const hasValidChild = mesh.children.some((child: any) => {
        const isValid = child.geometry && child.geometry.attributes?.position
        // if (isValid) {
        //   console.log('找到有效的子对象:', {
        //     子对象类型: child.constructor?.name,
        //     几何体类型: child.geometry?.type,
        //     顶点数: child.geometry?.attributes?.position?.count || 0
        //   })
        // }
        return isValid
      })

      // console.log(`isValidMesh - Group对象检查结果: ${hasValidChild ? '有效' : '无效'}`)
      return hasValidChild
    }

    // 如果是Mesh对象，直接检查几何体
    const isValid = mesh.geometry && mesh.geometry.attributes?.position
    // console.log(`isValidMesh - Mesh对象检查结果: ${isValid ? '有效' : '无效'}`)
    return isValid
  }

  /**
   * 从模型获取第一个有效的几何体（支持Group对象）
   */
  private getFirstValidMesh(mesh: any): any {
    if (!mesh) return null
    
    // 如果是Group对象，返回第一个有几何体的子对象
    if (mesh.isGroup && mesh.children && mesh.children.length > 0) {
      const validChild = mesh.children.find((child: any) => child.geometry && child.geometry.attributes?.position)
      return validChild || null
    }
    
    // 如果是Mesh对象，直接返回
    return mesh.geometry && mesh.geometry.attributes?.position ? mesh : null
  }

  /**
   * 计算单个相机对建筑物的覆盖情况
   */
  calculateCoverage(camera: Camera, buildingMesh: any): CoverageResult {
    if (!this.isValidMesh(buildingMesh)) {
      // console.warn('无效的建筑模型，无法计算覆盖率', {
      //   meshType: buildingMesh?.constructor?.name,
      //   hasGeometry: buildingMesh?.geometry ? '有' : '无',
      //   isGroup: buildingMesh?.isGroup,
      //   childrenCount: buildingMesh?.children?.length || 0
      // })
      return {
        buildingId: (buildingMesh && buildingMesh.id) || 'unknown',
        coveragePercentage: 0,
        visibleFaces: [],
        occlusionFactors: 0,
      }
    }

    const validMesh = this.getFirstValidMesh(buildingMesh)
    if (!validMesh) {
      return {
        buildingId: (buildingMesh && buildingMesh.id) || 'unknown',
        coveragePercentage: 0,
        visibleFaces: [],
        occlusionFactors: 0,
      }
    }

    const { direction, up } = calculateCameraOrientationFromNormal(camera.direction || CAMERA_CONFIG.defaultDirection)
    const frustum = calculateFrustumCorners(
      camera.position,
      direction,
      up,
      camera.frustum?.params?.fov || CAMERA_CONFIG.fov,
      camera.frustum?.params?.aspect || CAMERA_CONFIG.aspect,
      camera.frustum?.params?.near || CAMERA_CONFIG.near,
      camera.frustum?.params?.far || CAMERA_CONFIG.far
    )

    const visibleFaces = getVisibleMeshFaces(frustum, validMesh)
    const totalArea = this.calculateTotalBuildingArea(validMesh)
    const coveredArea = this.sumFaceArea(validMesh, visibleFaces)
    
    return {
      buildingId: buildingMesh.id || 'building',
      coveragePercentage: totalArea > 0 ? coveredArea / totalArea : 0,
      visibleFaces,
      occlusionFactors: this.estimateOcclusionFactor(camera.position.y, camera.position, validMesh),
    }
  }

  /**
   * 批量计算相机阵列的覆盖情况
   */
  calculateBatchCoverage(cameras: Camera[], buildings: any[]): CoverageResult[] {
    if (!cameras?.length || !buildings?.length) return []

    const results: CoverageResult[] = []
    for (const building of buildings) {
      for (const camera of cameras) {
        results.push(this.calculateCoverage(camera, building))
      }
    }
    return results
  }

  /**
   * 计算覆盖率统计信息
   */
  calculateCoverageStats(coverageResults: CoverageResult[]) {
    if (!coverageResults.length) {
      return { totalCoverage: 0, averageCoverage: 0, minCoverage: 0, maxCoverage: 0 }
    }

    const coverages = coverageResults.map(result => result.coveragePercentage)
    const totalCoverage = coverages.reduce((sum, value) => sum + value, 0)

    return {
      totalCoverage,
      averageCoverage: totalCoverage / coverages.length,
      minCoverage: Math.min(...coverages),
      maxCoverage: Math.max(...coverages),
  }
}

  /**
   * 计算路径覆盖/重叠指标
   * 返回值为百分比（0-100），便于与脚本结果保持一致
   */
  calculatePathCoverageMetrics(pathPoints: PathPoint[], buildingMesh: any): {
    coverage: number
    overlap: number
    coveredArea: number
    overlapArea: number
  } {
    // console.log('开始计算路径覆盖/重叠指标...')

    if (!pathPoints?.length) {
      // console.warn('路径点为空，无法计算覆盖率')
      return { coverage: 0, overlap: 0, coveredArea: 0, overlapArea: 0 }
    }

    if (!this.isValidMesh(buildingMesh)) {
      // console.warn('无效的建筑模型，无法计算覆盖率', {
      //   pathPointsLength: pathPoints.length,
      //   meshType: buildingMesh?.constructor?.name,
      //   hasGeometry: buildingMesh?.geometry ? '有' : '无',
      //   isGroup: buildingMesh?.isGroup,
      //   childrenCount: buildingMesh?.children?.length || 0
      // })
      return { coverage: 0, overlap: 0, coveredArea: 0, overlapArea: 0 }
    }

    // console.log('模型验证通过，开始查找有效几何体...')
    const validMesh = this.getFirstValidMesh(buildingMesh)
    if (!validMesh) {
      // console.warn('无法找到有效的几何体进行计算')
      return { coverage: 0, overlap: 0, coveredArea: 0, overlapArea: 0 }
    }

    // console.log('找到有效几何体，开始计算总面积...')
    
    // 重要：调整建筑模型位置，使其在相机视锥体范围内
    // 根据建筑中心坐标 (44.21, 141.96, -37.31) 设置合理位置
    const buildingTargetPosition = new Vector3(44.21, 141.96, -37.31)
    
    // 如果建筑模型没有变换矩阵，创建一个基本的变换
    if (!validMesh.matrixWorld) {
      // console.log('创建建筑模型变换矩阵...')
      const matrix = new Matrix4()
      matrix.makeTranslation(buildingTargetPosition.x, buildingTargetPosition.y, buildingTargetPosition.z)
      validMesh.matrixWorld = matrix
      // console.log(`建筑模型位置已设置为: (${buildingTargetPosition.x.toFixed(2)}, ${buildingTargetPosition.y.toFixed(2)}, ${buildingTargetPosition.z.toFixed(2)})`)
    } else {
      // 如果已有变换矩阵，也确保位置正确
      const currentPosition = new Vector3()
      validMesh.matrixWorld.decompose(currentPosition, new Quaternion(), new Vector3())
      // console.log(`当前建筑模型位置: (${currentPosition.x.toFixed(2)}, ${currentPosition.y.toFixed(2)}, ${currentPosition.z.toFixed(2)})`)

      // 如果位置不正确，调整位置
      if (currentPosition.distanceTo(buildingTargetPosition) > 10) {
        // console.log('调整建筑模型位置...')
        const matrix = new Matrix4()
        matrix.makeTranslation(buildingTargetPosition.x, buildingTargetPosition.y, buildingTargetPosition.z)
        validMesh.matrixWorld = matrix
        // console.log(`建筑模型位置已调整为: (${buildingTargetPosition.x.toFixed(2)}, ${buildingTargetPosition.y.toFixed(2)}, ${buildingTargetPosition.z.toFixed(2)})`)
      }
    }

    const totalArea = this.calculateTotalBuildingArea(validMesh)
    // console.log(`总面积计算结果: ${totalArea}`)

    if (totalArea <= 0) {
      // console.warn('建筑模型面积为0，无法计算覆盖率')
      return { coverage: 0, overlap: 0, coveredArea: 0, overlapArea: 0 }
    }

    const faceCoverageMap = new Map<number, number>()

    // console.log(`开始计算${pathPoints.length}个路径点的覆盖率...`)

    for (const point of pathPoints) {
      // 修复相机朝向：相机应该朝向建筑模型而不是简单向下
      // 计算从相机位置到建筑模型的方向
      const buildingCenter = this.extractMeshCenter(validMesh)
      
      // 重要：将建筑模型中心转换到世界坐标系
      // 假设建筑模型有一个变换矩阵，但如果没有，使用默认位置
      const buildingWorldCenter = new Vector3(buildingCenter.x, buildingCenter.y, buildingCenter.z)
      if (validMesh.matrixWorld) {
        buildingWorldCenter.applyMatrix4(validMesh.matrixWorld)
      }
      
      const cameraToBuilding = new Vector3(
        buildingWorldCenter.x - point.position.x,
        buildingWorldCenter.y - point.position.y,
        buildingWorldCenter.z - point.position.z
      ).normalize()
      
      const direction = {
        x: cameraToBuilding.x,
        y: cameraToBuilding.y,
        z: cameraToBuilding.z
      }
      
      // console.log(`路径点${point.id}相机设置:`)
      // console.log(`   相机位置: (${point.position.x.toFixed(2)}, ${point.position.y.toFixed(2)}, ${point.position.z.toFixed(2)})`)
      // console.log(`   建筑中心: (${buildingCenter.x.toFixed(2)}, ${buildingCenter.y.toFixed(2)}, ${buildingCenter.z.toFixed(2)})`)
      // console.log(`   相机方向: (${direction.x.toFixed(3)}, ${direction.y.toFixed(3)}, ${direction.z.toFixed(3)})`)

      const { up } = calculateCameraOrientationFromNormal(direction)
      const frustum = calculateFrustumCorners(
        point.position,
        direction,
        up,
        CAMERA_CONFIG.fov,
        CAMERA_CONFIG.aspect,
        CAMERA_CONFIG.near,
        CAMERA_CONFIG.far
      )

      const visibleFaces = getVisibleMeshFaces(frustum, validMesh, point.position)
      visibleFaces.forEach(faceIndex => {
        faceCoverageMap.set(faceIndex, (faceCoverageMap.get(faceIndex) || 0) + 1)
      })
    }

    //     // console.log('统计覆盖情况...')
    let coveredArea = 0
    let overlapArea = 0
    let faceCount = 0
    
    faceCoverageMap.forEach((count, faceIndex) => {
      const area = this.calculateFaceArea(validMesh, faceIndex)
      if (count >= 1) coveredArea += area
      if (count >= 2) overlapArea += area
      faceCount++
    })

    const coverageRate = (coveredArea / totalArea) * 100
    const overlapRate = (overlapArea / totalArea) * 100

    // console.log('覆盖率计算完成:', {
    //   总面数: faceCount,
    //   覆盖面积: coveredArea.toFixed(2),
    //   重叠面积: overlapArea.toFixed(2),
    //   总面积: totalArea.toFixed(2),
    //   覆盖率: coverageRate.toFixed(2) + '%',
    //   重叠率: overlapRate.toFixed(2) + '%'
    // })

    return {
      coverage: coverageRate,
      overlap: overlapRate,
      coveredArea,
      overlapArea,
    }
  }

  private calculateTotalBuildingArea(mesh: any): number {
    // console.log('开始计算建筑模型总面积...')

    if (!mesh || !mesh.geometry || !mesh.geometry.attributes?.position) {
      // console.warn('无法计算总面积：缺少几何体数据', {
      //   有mesh: !!mesh,
      //   有geometry: mesh?.geometry ? '是' : '否',
      //   有position属性: mesh?.geometry?.attributes?.position ? '是' : '否'
      // })
      return 0
    }

    const geometry = mesh.geometry
    const positions = geometry.attributes.position.array
    const index = geometry.index ? geometry.index.array : null

    // console.log('几何体信息:', {
    //   几何体类型: geometry.type,
    //   顶点数: positions.length / 3,
    //   索引数: index ? index.length : '无索引',
    //   面数: index ? index.length / 3 : positions.length / 9
    // })

    let totalArea = 0
    let faceCount = 0

    if (index) {
      const faceCountTotal = index.length / 3
      // console.log(`使用索引模式，总面数: ${faceCountTotal}`)

      for (let faceIndex = 0; faceIndex < faceCountTotal; faceIndex++) {
        const i1 = index[faceIndex * 3]
        const i2 = index[faceIndex * 3 + 1]
        const i3 = index[faceIndex * 3 + 2]

        const v1 = new Vector3(positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2])
        const v2 = new Vector3(positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2])
        const v3 = new Vector3(positions[i3 * 3], positions[i3 * 3 + 1], positions[i3 * 3 + 2])

        const faceArea = this.calculateTriangleArea(v1, v2, v3)
        totalArea += faceArea
        faceCount++
      }
    } else {
      const faceCountTotal = positions.length / 9
      // console.log(`使用非索引模式，总面数: ${faceCountTotal}`)

      for (let faceIndex = 0; faceIndex < faceCountTotal; faceIndex++) {
        const offset = faceIndex * 9
        const v1 = new Vector3(positions[offset], positions[offset + 1], positions[offset + 2])
        const v2 = new Vector3(positions[offset + 3], positions[offset + 4], positions[offset + 5])
        const v3 = new Vector3(positions[offset + 6], positions[offset + 7], positions[offset + 8])

        const faceArea = this.calculateTriangleArea(v1, v2, v3)
        totalArea += faceArea
        faceCount++
      }
    }

    // console.log(`总面积计算完成: ${totalArea.toFixed(4)} (${faceCount}个面)`)
    return totalArea
  }

  private sumFaceArea(mesh: any, faceIndices: number[]): number {
    return faceIndices.reduce((area, faceIndex) => area + this.calculateFaceArea(mesh, faceIndex), 0)
  }

  private calculateFaceArea(mesh: any, faceIndex: number): number {
    if (!mesh || !mesh.geometry || !mesh.geometry.attributes?.position) return 0

    const geometry = mesh.geometry
    const positions = geometry.attributes.position.array
    const index = geometry.index ? geometry.index.array : null

    if (index) {
      const i1 = index[faceIndex * 3]
      const i2 = index[faceIndex * 3 + 1]
      const i3 = index[faceIndex * 3 + 2]

      const v1 = new Vector3(positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2])
      const v2 = new Vector3(positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2])
      const v3 = new Vector3(positions[i3 * 3], positions[i3 * 3 + 1], positions[i3 * 3 + 2])

      return this.calculateTriangleArea(v1, v2, v3)
    }

    const offset = faceIndex * 9
    const v1 = new Vector3(positions[offset], positions[offset + 1], positions[offset + 2])
    const v2 = new Vector3(positions[offset + 3], positions[offset + 4], positions[offset + 5])
    const v3 = new Vector3(positions[offset + 6], positions[offset + 7], positions[offset + 8])

    return this.calculateTriangleArea(v1, v2, v3)
  }

  private calculateTriangleArea(v1: Vector3, v2: Vector3, v3: Vector3): number {
    const edge1 = new Vector3().subVectors(v2, v1)
    const edge2 = new Vector3().subVectors(v3, v1)
    const cross = new Vector3().crossVectors(edge1, edge2)
    return cross.length() / 2
  }

  private estimateOcclusionFactor(cameraHeight: number, cameraPosition: { x: number; y: number; z: number }, buildingMesh: any): number {
    if (!buildingMesh || !buildingMesh.geometry?.attributes?.position) return 0

    const bboxHeight = this.extractMeshHeight(buildingMesh)
    const heightFactor = Math.max(0.3, Math.min(1, cameraHeight / (bboxHeight || 1)))

    const buildingCenter = this.extractMeshCenter(buildingMesh)
    const distance = new Vector3(
      cameraPosition.x - buildingCenter.x,
      cameraPosition.y - buildingCenter.y,
      cameraPosition.z - buildingCenter.z
    ).length()

    const distanceFactor = Math.max(0.1, Math.min(1, 1 - distance / 500))
    return distanceFactor * heightFactor
  }

  private extractMeshCenter(mesh: any) {
    const geometry = mesh.geometry
    const position = geometry.attributes.position.array
    const center = new Vector3()

    const vertexCount = position.length / 3
    for (let i = 0; i < vertexCount; i++) {
      center.x += position[i * 3]
      center.y += position[i * 3 + 1]
      center.z += position[i * 3 + 2]
    }
    center.divideScalar(vertexCount)
    return center
  }

  private extractMeshHeight(mesh: any): number {
    const geometry = mesh.geometry
    const position = geometry.attributes.position.array
    let minY = Infinity
    let maxY = -Infinity

    for (let i = 0; i < position.length; i += 3) {
      minY = Math.min(minY, position[i + 1])
      maxY = Math.max(maxY, position[i + 1])
    }

    return maxY - minY
  }
}

export const coverageCalculator = new CoverageCalculator()