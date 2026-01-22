package com.skypath.backend.service;

import com.skypath.backend.dto.KPIMetrics;
import com.skypath.backend.dto.WaypointData;
import com.skypath.backend.dto.MeshData;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * Service for KPI calculation
 * 完全对应前端的kpi-calculator.ts
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class KPICalculatorService {

    private final EnergyCalculatorService energyCalculatorService;
    private final CoverageCalculatorService coverageCalculatorService;
    private final CollisionDetectorService collisionDetectorService;

    /**
     * Calculate all KPI metrics for a given path
     * 对应前端的calculateAllKPIs
     */
    public KPIMetrics calculateAllKPIs(List<WaypointData> pathPoints, MeshData buildingMesh) {
        if (pathPoints == null || pathPoints.size() < 2) {
            throw new IllegalArgumentException("At least 2 waypoints are required for KPI calculation");
        }

        try {
            // 1. Calculate path length
            double pathLength = calculatePathLength(pathPoints);

            // 2. Calculate flight time
            double flightTime = energyCalculatorService.calculateFlightTime(pathLength);

            // 3. Calculate energy consumption
            double energy = energyCalculatorService.calculatePathEnergy(pathPoints);

            // 4. Calculate coverage and overlap
            Double coverage = null;
            Double overlap = null;

            if (buildingMesh != null) {
                try {
                    CoverageCalculatorService.CoverageMetrics metrics =
                        coverageCalculatorService.calculatePathCoverageMetrics(pathPoints, buildingMesh);
                    // 前端返回的是0-1的小数,所以除以100
                    coverage = Math.max(0, Math.min(1, metrics.coverage / 100.0));
                    overlap = Math.max(0, Math.min(1, metrics.overlap / 100.0));
                } catch (Exception e) {
                    log.error("覆盖率计算失败:", e);
                    // 计算失败时返回 null，前端会显示 N/A
                    coverage = null;
                    overlap = null;
                }
            } else {
                // 如果没有模型数据，也返回 null
                coverage = null;
                overlap = null;
            }

            // 5. Collision detection
            CollisionDetectorService.CollisionResult collisionResult;
            try {
                collisionResult = collisionDetectorService.detectPathCollisions(pathPoints, buildingMesh);
            } catch (Exception e) {
                log.error("碰撞检测失败:", e);
                // 如果碰撞检测失败，返回无碰撞结果
                collisionResult = new CollisionDetectorService.CollisionResult(0, false, new ArrayList<>());
            }

            // Build metrics
            KPIMetrics metrics = new KPIMetrics();
            try {
                metrics.setPathLength(Math.round(pathLength * 100.0) / 100.0);
                metrics.setFlightTime(Math.round(flightTime * 100.0) / 100.0);
                metrics.setEnergy(Math.round(energy * 100.0) / 100.0);
                metrics.setCoverage(coverage);
                metrics.setOverlap(overlap);
                metrics.setCollisionCount(collisionResult.collisionCount);
                metrics.setHasCollision(collisionResult.hasCollision);
                metrics.setStatus("completed");
                metrics.setProgress(100);

                // 添加碰撞详情(如果有的话)
                if (collisionResult.collisions != null && !collisionResult.collisions.isEmpty()) {
                    metrics.setCollisionDetails(collisionResult.collisions);
                }
            } catch (Exception e) {
                log.error("构建KPI指标失败:", e);
                throw new IllegalArgumentException("构建KPI指标失败: " + e.getMessage(), e);
            }

            return metrics;

        } catch (IllegalArgumentException e) {
            // 重新抛出参数异常
            throw e;
        } catch (Exception e) {
            log.error("KPI计算失败:", e);
            throw new IllegalArgumentException("KPI计算失败: " + e.getMessage(), e);
        }
    }

    /**
     * Calculate total path length
     */
    private double calculatePathLength(List<WaypointData> pathPoints) {
        double totalDistance = 0.0;
        for (int i = 1; i < pathPoints.size(); i++) {
            totalDistance += distance3D(pathPoints.get(i - 1), pathPoints.get(i));
        }
        return totalDistance;
    }

    /**
     * Calculate 3D distance between two waypoints
     */
    private double distance3D(WaypointData p1, WaypointData p2) {
        double dx = p2.getX() - p1.getX();
        double dy = p2.getY() - p1.getY();
        double dz = p2.getZ() - p1.getZ();
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
}
