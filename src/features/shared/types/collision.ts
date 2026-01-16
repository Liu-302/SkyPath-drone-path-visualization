/**
 * 碰撞检测相关类型定义
 * 
 * 文件作用：
 * - 定义碰撞检测的结果类型
 * - 定义碰撞相关的数据结构
 * 
 * 负责人：成员A
 * 使用方：成员A（碰撞检测服务）、成员B（可视化碰撞结果）
 */

/**
 * 碰撞检测结果
 */
export interface CollisionResult {
  /** 是否有碰撞 */
  hasCollision: boolean
  /** 碰撞类型 */
  collisionType: 'none' | 'partial' | 'full'
  /** 交集体积 */
  intersectionVolume: number
  /** 遮挡百分比 */
  obstructionPercentage: number
}

/**
 * 视锥体碰撞检测结果
 */
export interface FrustumCollisionResult {
  /** 是否有碰撞 */
  hasCollision: boolean
  /** 碰撞次数 */
  collisionCount: number
  /** 碰撞详情数组 */
  collisions: CollisionDetail[]
  /** 碰撞总严重程度（0-1） */
  totalSeverity: number
}

/**
 * 单个碰撞详情
 */
export interface CollisionDetail {
  /** 碰撞点索引 */
  pointIndex: number
  /** 碰撞点位置 */
  position: { x: number; y: number; z: number }
  /** 碰撞严重程度（0-1） */
  severity: number
  /** 碰撞类型 */
  type: CollisionType
  /** 碰撞的建筑物面索引（如果适用） */
  faceIndex?: number
  /** 碰撞的线段索引（线段碰撞时） */
  segmentIndex?: number
}

/**
 * 碰撞类型
 */
export enum CollisionType {
  /** 点碰撞（路径点与建筑物碰撞） */
  POINT = 'point',
  /** 线段碰撞（路径线段与建筑物碰撞） */
  SEGMENT = 'segment',
  /** 视锥体碰撞（相机视锥体与建筑物碰撞） */
  FRUSTUM = 'frustum'
}

/**
 * 碰撞检测参数
 */
export interface CollisionDetectionParams {
  /** 路径点数组 */
  pathPoints: Array<{
    id: number
    position: { x: number; y: number; z: number }
    normal: { x: number; y: number; z: number }
  }>
  /** 建筑物网格 */
  buildingMesh: any
  /** 碰撞检测选项 */
  options?: {
    /** 检测精度 */
    precision?: 'low' | 'medium' | 'high'
    /** 最小碰撞距离（米） */
    minDistance?: number
    /** 是否检测线段碰撞 */
    checkSegmentCollisions?: boolean
    /** 是否检测视锥体碰撞 */
    checkFrustumCollisions?: boolean
  }
}