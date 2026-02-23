/**
 * 固定参数配置
 * 
 * 文件作用：
 * - 定义固定的相机参数（FOV、宽高比等）
 * - 定义固定的能耗参数（速度、功耗等）
 * - 这些参数不需要用户配置，直接写死在代码中
 */

/**
 * 相机配置参数
 * 基于 DJI Phantom 4 Pro 实际规格
 * 数据来源：DJI官方技术规格
 */
export const CAMERA_CONFIG = {
  /** 相机垂直视场角（度）- Phantom 4 Pro 官方标注 84° 为对角线FOV，换算垂直FOV≈53° */
  fov: 53.1,
  
  /** 宽高比 - Phantom 4 Pro 支持16:9和4:3，默认使用16:9 */
  aspect: 16 / 9,
  
  /** 近平面距离（米） */
  near: 0.1,
  
  /** 远平面距离（米）- 用于计算和可视化，实际拍摄距离根据任务调整 */
  far: 1000,
  
  /** 默认朝向（向下） */
  defaultDirection: { x: 0, y: -1, z: 0 },
}

/**
 * 覆盖率/高亮计算参数（与 CAMERA_CONFIG 统一，基于 DJI Phantom 4 Pro 规格）
 * 用于播放累计覆盖率、预加载、高亮等，保证与 Mission Overview 的 Coverage Rate 统一
 */
export const COVERAGE_CONFIG = {
  /** 垂直视场角（度）- 与 CAMERA_CONFIG 一致，Phantom 4 Pro 对角线 FOV 84° 换算垂直 FOV≈53.1° */
  vfov: 53.1,
  /** 宽高比 - Phantom 4 Pro 16:9 */
  aspect: 16 / 9,
  /** 兜底远距离（当射线未命中时），与 CAMERA_CONFIG.far 一致 */
  fallbackH: 1000,
}

/**
 * 能耗配置参数
 * 基于 DJI Phantom 4 Pro 官方技术规格
 * 数据来源：DJI官方技术规格文档
 */
export const ENERGY_CONFIG = {
  /** 基础功耗（瓦特）- 基于电池容量和飞行时间估算
   * 电池容量：89.2 Wh，最大飞行时间：约30分钟
   * 平均功耗 = 89.2 Wh / 0.5 h = 178.4 W（包含悬停和飞行）
   * 悬停时功耗较低，取约30-40W
   */
  basePower: 35,
  
  /** 移动能耗系数 */
  moveCoefficient: 0.8,
  
  /** 单位距离功耗（Wh/m）- 基于电池容量和飞行时间精确计算
   * 定位模式最大水平速度：50 km/h = 13.89 m/s
   * 30分钟可飞行距离：13.89 m/s × 1800 s = 25002 m ≈ 25 km
   * 单位距离功耗 = 89.2 Wh / 25000 m = 0.003568 Wh/m
   * 考虑实际飞行中的加速、转向等，取0.004 Wh/m（更接近理论值）
   */
  powerPerMeter: 0.004,
  
  /** 爬升功耗系数（Wh/m高度差）- 爬升时额外功耗
   * 最大上升速度约5 m/s，折算额外功率约10~20 W
   * 对应每米额外耗电约0.002 Wh，取该值作为默认系数
   */
  climbPowerFactor: 0.002,
  
  /** 悬停功耗（瓦特）- 基于电池容量和飞行时间估算
   * 悬停时功耗较低，约30-40W，取30W
   */
  hoverPower: 30,
  
  /** 默认速度（米/秒）- 基于任务规划取保守巡航速度
   * 官方最大水平速度约13.9 m/s，这里按 5 m/s 作为保守默认值
   */
  speed: 5,
  
  /** 工业电价（元/千瓦时）- 中国工业电价参考值 */
  electricityRate: 0.8,
  
  /** 碳排放因子（千克CO2/千瓦时）- 中国电网平均碳排放因子 */
  carbonFactor: 0.583,
  
  /** 维护功耗比例 - 维护成本占能耗成本的比例 */
  maintenanceFactor: 0.01,
}

