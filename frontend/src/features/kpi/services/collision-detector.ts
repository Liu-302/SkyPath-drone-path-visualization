/**
 * 碰撞检测服务
 * 负责检测路径、视锥体与建筑物之间的相交关系
 *
 * 参考 `kpi_calculation_with_real_data.js`：
 * - 使用建筑物包围盒检测路径点/线段碰撞
 * - 通过视锥体包围盒近似计算遮挡体积
 */

import type { Camera, ViewFrustum } from '@/features/visualization/types/camera'
import type { CollisionResult } from '@/features/shared/types/collision'
import type { CollisionPoint } from '@/features/kpi/types/kpi'
import { Box3, Line3, Vector3, Ray } from 'three'

type PathPoint = {
  id: number
  position: { x: number; y: number; z: number }
  normal?: { x: number; y: number; z: number }
}

export class CollisionDetector {
  /**
   * 检测线段是否与包围盒相交
   * 使用射线检测方法：从包围盒中心向线段发射射线
   */
  private lineIntersectsBox(line: Line3, box: Box3): boolean {
    const lineStart = line.start
    const lineEnd = line.end

    // 快速检测：如果线段端点都在包围盒内，则相交
    if (box.containsPoint(lineStart) || box.containsPoint(lineEnd)) {
      return true
    }

    // 使用射线检测：从包围盒中心向线段发射两条射线
    const center = box.getCenter(new Vector3())
    const ray1 = new Ray(center, lineStart.clone().sub(center).normalize())
    const ray2 = new Ray(center, lineEnd.clone().sub(center).normalize())

    const intersection1 = ray1.intersectBox(box, new Vector3())
    const intersection2 = ray2.intersectBox(box, new Vector3())

    // 检查交点是否在线段范围内
    if (intersection1) {
      const distanceToStart = intersection1.distanceTo(lineStart)
      const lineLength = lineStart.distanceTo(lineEnd)
      if (distanceToStart <= lineLength) return true
    }

    if (intersection2) {
      const distanceToEnd = intersection2.distanceTo(lineEnd)
      const lineLength = lineStart.distanceTo(lineEnd)
      if (distanceToEnd <= lineLength) return true
    }

    // 检查包围盒的8个顶点是否在无限延伸的线段平面上
    const min = box.min
    const max = box.max
    const corners = [
      new Vector3(min.x, min.y, min.z),
      new Vector3(min.x, min.y, max.z),
      new Vector3(min.x, max.y, min.z),
      new Vector3(min.x, max.y, max.z),
      new Vector3(max.x, min.y, min.z),
      new Vector3(max.x, min.y, max.z),
      new Vector3(max.x, max.y, min.z),
      new Vector3(max.x, max.y, max.z),
    ]

    for (const corner of corners) {
      const cornerRay = new Ray(lineStart, lineEnd.clone().sub(lineStart).normalize())
      const cornerDistance = cornerRay.distanceSqToPoint(corner)
      const lineLengthSq = lineStart.distanceToSquared(lineEnd)
      const closestPoint = new Vector3()
      cornerRay.closestPointToPoint(corner, closestPoint)
      const projectDistance = closestPoint.distanceTo(lineStart)

      if (cornerDistance < 0.01 && projectDistance >= 0 && projectDistance <= Math.sqrt(lineLengthSq)) {
        return true
      }
    }

    return false
  }

  detectFrustumCollision(frustum1: ViewFrustum, frustum2: ViewFrustum): CollisionResult {
    const box1 = this.buildFrustumBoundingBox(frustum1)
    const box2 = this.buildFrustumBoundingBox(frustum2)
    const intersects = box1.intersectsBox(box2)

    return {
      hasCollision: intersects,
      collisionType: intersects ? 'partial' : 'none',
      intersectionVolume: intersects ? this.estimateIntersectionVolume(box1, box2) : 0,
      obstructionPercentage: intersects ? this.estimateObstruction(box1, box2) : 0,
    }
  }

  detectOcclusions(cameras: Camera[]): CollisionResult[] {
    if (!cameras?.length) return []

    const results: CollisionResult[] = []
    for (let i = 0; i < cameras.length; i++) {
      for (let j = i + 1; j < cameras.length; j++) {
        results.push(this.detectFrustumCollision(cameras[i].frustum, cameras[j].frustum))
      }
    }
    return results
  }

  detectBuildingOcclusion(camera: Camera, buildings: any[]) {
    if (!buildings?.length) {
      return { occludedBuildings: 0, totalOcclusionFactor: 0 }
    }

    let occluded = 0
    let occlusionFactor = 0
    const cameraPos = new Vector3(camera.position.x, camera.position.y, camera.position.z)

    for (const building of buildings) {
      const bbox = this.extractBoundingBox(building)
      if (!bbox) continue

      const target = bbox.getCenter(new Vector3())
      const sightLine = new Line3(cameraPos, target)
      const intersects = this.lineIntersectsBox(sightLine, bbox)

      if (intersects) {
        occluded++
        const distance = cameraPos.distanceTo(target)
        occlusionFactor += Math.max(0.1, Math.min(1, 200 / (distance + 1)))
      }
    }

    return {
      occludedBuildings: occluded,
      totalOcclusionFactor: occlusionFactor,
    }
  }

  calculateCollisionStats(collisionResults: CollisionResult[]) {
    if (!collisionResults.length) {
      return { totalCollisions: 0, averageObstruction: 0, criticalCollisions: 0 }
    }

    const totalCollisions = collisionResults.filter(result => result.hasCollision).length
    const obstructionValues = collisionResults.map(result => result.obstructionPercentage)
    const averageObstruction =
      obstructionValues.reduce((sum, value) => sum + value, 0) / obstructionValues.length
    const criticalCollisions = collisionResults.filter(result => result.obstructionPercentage > 0.6).length

    return { totalCollisions, averageObstruction, criticalCollisions }
  }

  /**
   * 基于真实脚本实现的路径碰撞检测
   */
  detectPathCollisions(pathPoints: PathPoint[], buildingMesh: any) {
    if (!pathPoints?.length || !buildingMesh || !buildingMesh.geometry) {
      return { collisionCount: 0, hasCollision: false, collisions: [] as CollisionPoint[] }
    }

    const bbox = this.extractBoundingBox(buildingMesh)
    if (!bbox) {
      return { collisionCount: 0, hasCollision: false, collisions: [] as CollisionPoint[] }
    }

    const collisions: CollisionPoint[] = []
    const bboxCenter = bbox.getCenter(new Vector3())
    const bboxSize = bbox.getSize(new Vector3()).length() || 1

    // 点碰撞（路径点位于建筑物内部）
    pathPoints.forEach((point, index) => {
      const position = new Vector3(point.position.x, point.position.y, point.position.z)
      if (bbox.containsPoint(position)) {
        const severity = 1 - Math.min(1, position.distanceTo(bboxCenter) / bboxSize)
        collisions.push({
          position: point.position,
          severity,
          time: index,
        })
      }
    })

    // 线段碰撞（路径段穿过建筑物）
    for (let i = 1; i < pathPoints.length; i++) {
      const start = new Vector3(
        pathPoints[i - 1].position.x,
        pathPoints[i - 1].position.y,
        pathPoints[i - 1].position.z
      )
      const end = new Vector3(pathPoints[i].position.x, pathPoints[i].position.y, pathPoints[i].position.z)
      const segment = new Line3(start, end)

      if (this.lineIntersectsBox(segment, bbox)) {
        const midpoint = start.clone().add(end).multiplyScalar(0.5)
        const severity = 1 - Math.min(1, midpoint.distanceTo(bboxCenter) / bboxSize)
        collisions.push({
          position: { x: midpoint.x, y: midpoint.y, z: midpoint.z },
          severity,
          time: i,
        })
      }
    }

    return {
      collisionCount: collisions.length,
      hasCollision: collisions.length > 0,
      collisions,
    }
  }

  private buildFrustumBoundingBox(frustum: ViewFrustum): Box3 {
    const box = new Box3()
    const points = [...frustum.corners.near, ...frustum.corners.far]
    points.forEach(point => {
      box.expandByPoint(new Vector3(point.x, point.y, point.z))
    })
    return box
  }

  private estimateIntersectionVolume(box1: Box3, box2: Box3): number {
    const intersection = box1.clone().intersect(box2)
    const size = intersection.getSize(new Vector3())
    return Math.max(0, size.x) * Math.max(0, size.y) * Math.max(0, size.z)
  }

  private estimateObstruction(box1: Box3, box2: Box3): number {
    const volume1 = box1.getSize(new Vector3()).length() || 1
    const volume2 = box2.getSize(new Vector3()).length() || 1
    const overlap = this.estimateIntersectionVolume(box1, box2)
    const maxVolume = Math.max(volume1, volume2)
    return Math.min(1, overlap / maxVolume)
  }

  private extractBoundingBox(mesh: any): Box3 | null {
    if (!mesh || !mesh.geometry || !mesh.geometry.attributes?.position) return null

    const bbox = new Box3()
    const position = mesh.geometry.attributes.position.array
    for (let i = 0; i < position.length; i += 3) {
      bbox.expandByPoint(new Vector3(position[i], position[i + 1], position[i + 2]))
    }
    return bbox
  }
}

export const collisionDetector = new CollisionDetector()