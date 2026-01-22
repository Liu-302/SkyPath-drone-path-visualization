package com.skypath.backend.service;

import com.skypath.backend.dto.WaypointData;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 能耗计算服务
 * 对应前端的energy-calculator.ts
 */
@Service
@Slf4j
public class EnergyCalculatorService {

    // 能耗配置参数(对应ENERGY_CONFIG)
    private static final double POWER_PER_METER = 0.004;    // Wh/m
    private static final double CLIMB_POWER_FACTOR = 0.002; // Wh/m(高度差)
    private static final double SPEED = 5.0;                 // m/s

    /**
     * 计算路径总能耗(Wh)
     * 对应前端的calculatePathEnergy
     */
    public double calculatePathEnergy(List<WaypointData> pathPoints) {
        if (pathPoints == null || pathPoints.size() < 2) {
            return 0.0;
        }

        return calculatePathPowerConsumption(pathPoints);
    }

    /**
     * 计算路径功耗
     */
    private double calculatePathPowerConsumption(List<WaypointData> pathPoints) {
        if (pathPoints == null || pathPoints.size() < 2) {
            return 0.0;
        }

        double totalPower = 0.0;

        for (int i = 1; i < pathPoints.size(); i++) {
            WaypointData prev = pathPoints.get(i - 1);
            WaypointData curr = pathPoints.get(i);

            // 计算距离
            double dx = curr.getX() - prev.getX();
            double dy = curr.getY() - prev.getY();
            double dz = curr.getZ() - prev.getZ();
            double distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

            // 能量计算
            double basePower = distance * POWER_PER_METER;
            double climbPower = Math.abs(dy) * CLIMB_POWER_FACTOR;

            totalPower += basePower + climbPower;
        }

        return totalPower;
    }

    /**
     * 计算飞行时间(秒)
     * @param pathLength 路径长度(米)
     */
    public double calculateFlightTime(double pathLength) {
        return pathLength / SPEED;
    }
}
