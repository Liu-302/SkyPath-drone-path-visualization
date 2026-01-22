/**
 * 服务层统一导出文件
 * 统一导出所有服务，便于其他地方导入使用
 */

export { calculateAllKPIs, getCalculationProgress, cancelCalculation, getCalculationStatus } from '../../features/kpi/services/kpi-calculator';
export { coverageCalculator } from '../../features/kpi/services/coverage-calculator';
export { collisionDetector } from '../../features/kpi/services/collision-detector';
export { energyCalculator } from '../../features/kpi/services/energy-calculator';
export { calculateViewpointDetail, calculateCameraAngleFromNormal } from '../../features/visualization/services/viewpoint-calculator';

// 配置常量
export { CAMERA_CONFIG, ENERGY_CONFIG } from '../constants/constants';