/**
 * 相机视锥体类型定义
 * 
 * 文件作用：
 * - 定义相机视锥体相关的类型接口
 * - 定义相机视角、视锥体角点、投影结果等类型
 * 
 * 负责人：成员A实现，成员C/D检查
 * 使用方：
 * - 成员A：在覆盖率计算中使用这些类型
 * - 成员C/D：在视锥体可视化组件中使用已检查的类型
 */

/**
 * 相机视角信息
 */
export interface CameraView {
  /** 相机位置 */
  position: { 
    x: number
    y: number
    z: number
  }
  
  /** 相机朝向向量（归一化） */
  direction: { 
    x: number
    y: number
    z: number
  }
  
  /** 相机上方向向量（归一化） */
  up: { 
    x: number
    y: number
    z: number
  }
  
  /** 视场角（度） */
  fov: number
  
  /** 宽高比 */
  aspect: number
  
  /** 近平面距离 */
  near: number
  
  /** 远平面距离 */
  far: number
}

/**
 * 视锥体参数
 */
export interface FrustumParams {
  /** 视场角（度） */
  fov: number
  
  /** 宽高比 */
  aspect: number
  
  /** 近平面距离 */
  near: number
  
  /** 远平面距离 */
  far: number
}

/**
 * 视锥体八个角点坐标
 * 近平面和远平面各4个角点
 */
export interface FrustumCorners {
  /** 近平面四个角点（左下、右下、右上、左上） */
  near: [
    { x: number; y: number; z: number },  // 左下
    { x: number; y: number; z: number },  // 右下
    { x: number; y: number; z: number },  // 右上
    { x: number; y: number; z: number }   // 左上
  ]
  
  /** 远平面四个角点（左下、右下、右上、左上） */
  far: [
    { x: number; y: number; z: number },
    { x: number; y: number; z: number },
    { x: number; y: number; z: number },
    { x: number; y: number; z: number }
  ]
}

/**
 * 相机定义
 */
export interface Camera {
  id: string
  type: 'high-res' | 'standard' // 相机类型
  position: { x: number; y: number; z: number }
  direction: { x: number; y: number; z: number }
  frustum: ViewFrustum
}

/**
 * 建筑物定义
 */
export interface Building {
  id: string
  vertices: { x: number; y: number; z: number }[]
  faces: number[]
}

/**
 * 视点定义
 */
export interface Viewpoint {
  id: string
  position: { x: number; y: number; z: number }
  normal: { x: number; y: number; z: number }
  camera: Camera
}

/**
 * 视锥体定义
 */
export interface ViewFrustum {
  corners: FrustumCorners
  params: FrustumParams
}

/**
 * 相机定义
 */
export interface Camera {
  id: string
  type: 'high-res' | 'standard' // 相机类型
  position: { x: number; y: number; z: number }
  direction: { x: number; y: number; z: number }
  frustum: ViewFrustum
}

/**
 * 建筑物定义
 */
export interface Building {
  id: string
  vertices: { x: number; y: number; z: number }[]
  faces: number[]
}

/**
 * 视点定义
 */
export interface Viewpoint {
  id: string
  position: { x: number; y: number; z: number }
  normal: { x: number; y: number; z: number }
  camera: Camera
}

/**
 * 视锥体定义
 */
export interface ViewFrustum {
  corners: FrustumCorners
  params: FrustumParams
}

/**
 * 投影到建筑物上的结果
 */
export interface ProjectionResult {
  /** 可见面的索引数组 */
  visibleFaces: number[]
  
  /** 覆盖面积（平方米） */
  coverageArea: number
  
  /** 高亮的网格对象（Three.js Mesh，可选） */
  highlightedMesh?: any
}

