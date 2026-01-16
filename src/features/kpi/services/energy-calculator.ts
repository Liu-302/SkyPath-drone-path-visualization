/**
 * 能耗计算服务
 * 负责计算相机部署和运行过程中的能耗指标
 *
 * 参考 `kpi_calculation_with_real_data.js`：
 * - 使用路径段的距离与高度差估算能耗
 * - 结合能耗配置计算运营成本与碳排放
 */

import { ENERGY_CONFIG } from '@/shared/constants/constants'

type PathPoint = {
  id: number
  position: { x: number; y: number; z: number }
  normal?: { x: number; y: number; z: number }
}

export class EnergyCalculator {
  /**
   * 根据路径点计算总能耗（单位：kWh）
   */
  calculatePathEnergy(pathPoints: PathPoint[]): number {
    if (!pathPoints || pathPoints.length < 2) return 0
    return this.calculatePathPowerConsumption(pathPoints)
  }

  private calculatePathPowerConsumption(pathPoints: PathPoint[]): number {
    if (!pathPoints || pathPoints.length < 2) return 0

    let totalPower = 0
    for (let i = 1; i < pathPoints.length; i++) {
      const prev = pathPoints[i - 1].position
      const curr = pathPoints[i].position

      const dx = curr.x - prev.x
      const dy = curr.y - prev.y
      const dz = curr.z - prev.z
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)

      const basePower = distance * ENERGY_CONFIG.powerPerMeter
      const climbPower = Math.abs(dy) * ENERGY_CONFIG.climbPowerFactor

      totalPower += basePower + climbPower
    }

    return totalPower
  }
}

export const energyCalculator = new EnergyCalculator()