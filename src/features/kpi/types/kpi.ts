/**
 * KPI指标类型定义
 * 
 * 文件作用：
 * - 定义无人机路径分析的KPI指标类型
 * - 定义KPI计算结果的数据结构
 * 
 * 负责人：成员A
 * 使用方：成员A（KPI计算服务）、成员B（KPI可视化）
 */

import { CollisionResult } from "@/features/shared/types/collision";

/**
 * 碰撞点信息
 */
export interface CollisionPoint {
  /** 碰撞点位置 */
  position: { x: number; y: number; z: number }
  /** 碰撞严重程度（0-1，0为无碰撞，1为严重碰撞） */
  severity: number
  /** 碰撞的面索引（如果与建筑物碰撞） */
  faceIndex?: number
  /** 碰撞时间（相对于路径开始的时间） */
  time: number
}

/**
 * 航点信息
 */
export interface Waypoint {
  /** 航点名称 */
  name: string
  /** 纬度 */
  latitude: string | number
  /** 经度 */
  longitude: string | number
  /** 高度（毫米） */
  altitude: string | number
  /** 距起点的距离（公里） */
  distanceFromStart: string | number
  /** 速度（米/秒） */
  speed: string | number
  /** 预计时间（分钟） */
  estimatedTime: string | number
  /** 与前一点的距离 */
  segmentLength: string | number
}

/**
 * 视点信息
 */
export interface Viewpoint {
  /** 俯仰角 */
  pitch: string | number
  /** 偏航角 */
  yaw: string | number
  /** 翻滚角 */
  roll: string | number
  /** 与前一帧的重叠率（百分比，null表示不可用） */
  overlap: number | null
}

/**
 * KPI指标计算结果
 */
export interface KPIMetrics {
  /** 路径总长度（米） */
  pathLength: number
  /** 飞行时间（秒） */
  flightTime: number
  /** 覆盖率（0-1，百分比形式），null表示计算失败 */
  coverage: number | null
  /** 重叠率（0-1，百分比形式），null表示计算失败 */
  overlap: number | null
  /** 碰撞次数 */
  collisionCount: number
  /** 是否有碰撞 */
  hasCollision: boolean
  /** 总能耗（焦耳或瓦时） */
  energy: number
  /** 碰撞详情（可选） */
  collisionDetails?: CollisionPoint[]
  /** 计算状态 */
  status: 'idle' | 'calculating' | 'completed' | 'error'
  /** 计算进度（0-100） */
  progress?: number
}

/**
 * KPI计算参数
 */
export interface KPICalcParams {
  /** 路径点数组 */
  pathPoints: Array<{
    id: number
    position: { x: number; y: number; z: number }
    normal: { x: number; y: number; z: number }
  }>
  /** 建筑物网格（Three.js Mesh） */
  buildingMesh: any
  /** 计算选项 */
  options?: {
    /** 是否计算详细碰撞信息 */
    includeCollisionDetails?: boolean
    /** 是否实时更新进度 */
    reportProgress?: boolean
    /** 计算精度（影响性能） */
    precision?: 'low' | 'medium' | 'high'
  }
}

/**
 * 单个视点的KPI信息
 */
export interface ViewpointKPI {
  /** 视点索引 */
  index: number
  /** 该视点的覆盖面积 */
  coverageArea: number
  /** 是否与建筑物碰撞 */
  hasCollision: boolean
  /** 与建筑物的距离 */
  distanceToBuilding: number
  /** 相机角度信息 */
  cameraAngle: {
    pitch: number
    yaw: number
    roll: number
  }
}

/**
 * 覆盖范围计算结果
 */
export interface CoverageResult {
  buildingId: string
  coveragePercentage: number
  visibleFaces: number[]
  occlusionFactors: number
}

/**
 * 能耗计算结果
 */
export interface EnergyResult {
  cameraId: string
  powerConsumption: number
  operationalCost: number
  maintenanceCost: number
  carbonFootprint: number
}

/**
 * KPI聚合结果
 */
export interface KPIResult {
  coverage: CoverageResult[]
  collision: CollisionResult[]
  energy: EnergyResult[]
  overallScore: number
  recommendations: string[]
}

/**
 * 覆盖范围计算结果
 */
export interface CoverageResult {
  buildingId: string
  coveragePercentage: number
  visibleFaces: number[]
  occlusionFactors: number
}

/**
 * 能耗计算结果
 */
export interface EnergyResult {
  cameraId: string
  powerConsumption: number
  operationalCost: number
  maintenanceCost: number
  carbonFootprint: number
}

/**
 * KPI聚合结果
 */
export interface KPIResult {
  coverage: CoverageResult[]
  collision: CollisionResult[]
  energy: EnergyResult[]
  overallScore: number
  recommendations: string[]
}