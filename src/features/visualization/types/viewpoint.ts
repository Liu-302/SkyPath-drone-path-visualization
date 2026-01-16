/**
 * 视点详细信息类型定义
 * 
 * 文件作用：
 * - 定义视点详细信息的类型接口
 * - 定义从JSON路径文件中解析出的原始视点数据类型
 */

/**
 * 视点详细信息接口
 * 包含选中视点的所有计算和显示信息
 */
export interface ViewpointDetail {
  /** 视点在路径中的索引（从0开始） */
  index: number
  
  /** 视点位置坐标 */
  position: { 
    x: number
    y: number
    z: number
  }
  
  /** 照相机角度（从JSON文件中读取，如果JSON中没有则使用默认值） */
  cameraAngle: {
    /** 俯仰角（度）：-90到90，0为水平，正值为向上 */
    pitch: number
    /** 偏航角（度）：0到360，0为北，顺时针增加 */
    yaw: number
    /** 翻滚角（度）：-180到180，0为水平 */
    roll: number
  }
  
  /** 已飞行距离（从起点到该点的累计距离，单位：米） */
  traveledDistance: number
  
  /** 已用时间（从起点到该点的时间，单位：秒） */
  elapsedTime: number
  
  /** 当前速度（单位：米/秒） */
  currentSpeed: number
  
  /** 与上一视点的距离（单位：米，如果是第一个点则为0） */
  distanceToPrevious: number
}

/**
 * 从JSON路径文件中解析出的原始视点数据
 * 对应实际JSON格式：{ id, position: {x,y,z}, normal: {x,y,z} }
 */
export interface ViewpointData {
  /** 采样点编号 */
  id: number
  
  /** 位置坐标 */
  position: { 
    x: number
    y: number
    z: number
  }
  
  /** 相机朝向向量（归一化方向向量，用于确定相机朝向） */
  normal: { 
    x: number
    y: number
    z: number
  }
}

