package com.skypath.backend.service;

import com.skypath.backend.dto.WaypointData;
import com.skypath.backend.dto.MeshData;
import com.skypath.backend.util.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * 覆盖范围计算服务
 * 对应前端的coverage-calculator.ts
 */
@Service
@Slf4j
public class CoverageCalculatorService {

    // 相机配置参数(对应CAMERA_CONFIG)
    private static final double CAMERA_FOV = 53.1;
    private static final double CAMERA_ASPECT = 16.0 / 9.0;
    private static final double CAMERA_NEAR = 0.1;
    private static final double CAMERA_FAR = 1000.0;

    /**
     * 计算路径覆盖/重叠指标
     * 对应前端的calculatePathCoverageMetrics
     */
    public CoverageMetrics calculatePathCoverageMetrics(List<WaypointData> pathPoints, MeshData buildingMesh) {
        if (pathPoints == null || pathPoints.isEmpty()) {
            log.warn("路径点为空,无法计算覆盖率");
            return new CoverageMetrics(0, 0, 0, 0);
        }

        if (buildingMesh == null || buildingMesh.getVertices() == null || buildingMesh.getVertices().isEmpty()) {
            log.warn("无效的建筑模型,无法计算覆盖率");
            return new CoverageMetrics(0, 0, 0, 0);
        }

        // 计算建筑物总面积
        double totalArea = calculateTotalBuildingArea(buildingMesh);
        if (totalArea <= 0) {
            log.warn("建筑模型面积为0,无法计算覆盖率");
            return new CoverageMetrics(0, 0, 0, 0);
        }

        // 统计每个面的覆盖次数
        Map<Integer, Integer> faceCoverageMap = new HashMap<>();

        // 遍历每个路径点,计算可见面
        for (WaypointData point : pathPoints) {
            Vector3 position = new Vector3(point.getX(), point.getY(), point.getZ());

            // 计算相机方向(朝向建筑物)
            Vector3 buildingCenter = extractMeshCenter(buildingMesh);
            Vector3 cameraToBuilding = Vector3.subVectors(buildingCenter, position);
            cameraToBuilding.normalize();

            Vector3 direction = cameraToBuilding;

            // 计算上方向
            FrustumCalculator.CameraOrientation orientation =
                FrustumCalculator.calculateCameraOrientationFromNormal(direction);
            Vector3 up = orientation.up;

            // 计算视锥体
            FrustumCorners frustum = FrustumCalculator.calculateFrustumCorners(
                position,
                direction,
                up,
                CAMERA_FOV,
                CAMERA_ASPECT,
                CAMERA_NEAR,
                CAMERA_FAR
            );

            // 获取可见面
            Set<Integer> visibleFaces = getVisibleMeshFaces(frustum, buildingMesh, position);

            // 统计覆盖次数
            for (int faceIndex : visibleFaces) {
                faceCoverageMap.put(faceIndex, faceCoverageMap.getOrDefault(faceIndex, 0) + 1);
            }
        }

        // 计算覆盖面积和重叠面积
        double coveredArea = 0;
        double overlapArea = 0;

        for (Map.Entry<Integer, Integer> entry : faceCoverageMap.entrySet()) {
            int faceIndex = entry.getKey();
            int count = entry.getValue();

            double area = calculateFaceArea(buildingMesh, faceIndex);
            if (count >= 1) coveredArea += area;
            if (count >= 2) overlapArea += area;
        }

        // 计算覆盖率和重叠率(百分比)
        double coverageRate = totalArea > 0 ? (coveredArea / totalArea) * 100 : 0;
        double overlapRate = totalArea > 0 ? (overlapArea / totalArea) * 100 : 0;

        return new CoverageMetrics(coverageRate, overlapRate, coveredArea, overlapArea);
    }

    /**
     * 计算建筑物总面积
     */
    private double calculateTotalBuildingArea(MeshData mesh) {
        if (mesh == null || mesh.getVertices() == null || mesh.getVertices().isEmpty()) {
            return 0;
        }

        List<Double> vertices = mesh.getVertices();
        List<Integer> indices = mesh.getIndices();

        double totalArea = 0;

        if (indices != null && !indices.isEmpty()) {
            // 有索引的三角形网格
            int faceCount = indices.size() / 3;
            for (int faceIndex = 0; faceIndex < faceCount; faceIndex++) {
                int i1 = indices.get(faceIndex * 3);
                int i2 = indices.get(faceIndex * 3 + 1);
                int i3 = indices.get(faceIndex * 3 + 2);

                Vector3 v1 = new Vector3(
                    vertices.get(i1 * 3),
                    vertices.get(i1 * 3 + 1),
                    vertices.get(i1 * 3 + 2)
                );
                Vector3 v2 = new Vector3(
                    vertices.get(i2 * 3),
                    vertices.get(i2 * 3 + 1),
                    vertices.get(i2 * 3 + 2)
                );
                Vector3 v3 = new Vector3(
                    vertices.get(i3 * 3),
                    vertices.get(i3 * 3 + 1),
                    vertices.get(i3 * 3 + 2)
                );

                totalArea += calculateTriangleArea(v1, v2, v3);
            }
        } else {
            // 无索引的三角形列表
            int faceCount = vertices.size() / 9;
            for (int faceIndex = 0; faceIndex < faceCount; faceIndex++) {
                Vector3 v1 = new Vector3(
                    vertices.get(faceIndex * 9),
                    vertices.get(faceIndex * 9 + 1),
                    vertices.get(faceIndex * 9 + 2)
                );
                Vector3 v2 = new Vector3(
                    vertices.get(faceIndex * 9 + 3),
                    vertices.get(faceIndex * 9 + 4),
                    vertices.get(faceIndex * 9 + 5)
                );
                Vector3 v3 = new Vector3(
                    vertices.get(faceIndex * 9 + 6),
                    vertices.get(faceIndex * 9 + 7),
                    vertices.get(faceIndex * 9 + 8)
                );

                totalArea += calculateTriangleArea(v1, v2, v3);
            }
        }

        return totalArea;
    }

    /**
     * 计算单个面的面积
     */
    private double calculateFaceArea(MeshData mesh, int faceIndex) {
        if (mesh == null || mesh.getVertices() == null || mesh.getVertices().isEmpty()) {
            return 0;
        }

        List<Double> vertices = mesh.getVertices();
        List<Integer> indices = mesh.getIndices();

        Vector3 v1, v2, v3;

        if (indices != null && !indices.isEmpty()) {
            int i1 = indices.get(faceIndex * 3);
            int i2 = indices.get(faceIndex * 3 + 1);
            int i3 = indices.get(faceIndex * 3 + 2);

            v1 = new Vector3(
                vertices.get(i1 * 3),
                vertices.get(i1 * 3 + 1),
                vertices.get(i1 * 3 + 2)
            );
            v2 = new Vector3(
                vertices.get(i2 * 3),
                vertices.get(i2 * 3 + 1),
                vertices.get(i2 * 3 + 2)
            );
            v3 = new Vector3(
                vertices.get(i3 * 3),
                vertices.get(i3 * 3 + 1),
                vertices.get(i3 * 3 + 2)
            );
        } else {
            int offset = faceIndex * 9;
            v1 = new Vector3(
                vertices.get(offset),
                vertices.get(offset + 1),
                vertices.get(offset + 2)
            );
            v2 = new Vector3(
                vertices.get(offset + 3),
                vertices.get(offset + 4),
                vertices.get(offset + 5)
            );
            v3 = new Vector3(
                vertices.get(offset + 6),
                vertices.get(offset + 7),
                vertices.get(offset + 8)
            );
        }

        return calculateTriangleArea(v1, v2, v3);
    }

    /**
     * 计算三角形面积
     */
    private double calculateTriangleArea(Vector3 v1, Vector3 v2, Vector3 v3) {
        Vector3 edge1 = Vector3.subVectors(v2, v1);
        Vector3 edge2 = Vector3.subVectors(v3, v1);
        Vector3 cross = Vector3.crossVectors(edge1, edge2);
        return cross.length() / 2.0;
    }

    /**
     * 提取网格中心点
     */
    private Vector3 extractMeshCenter(MeshData mesh) {
        List<Double> vertices = mesh.getVertices();
        Vector3 center = new Vector3();

        int vertexCount = vertices.size() / 3;
        for (int i = 0; i < vertexCount; i++) {
            center.x += vertices.get(i * 3);
            center.y += vertices.get(i * 3 + 1);
            center.z += vertices.get(i * 3 + 2);
        }
        center.multiply(1.0 / vertexCount);

        return center;
    }

    /**
     * 获取视锥体内可见的网格面
     * 对应前端的getVisibleMeshFaces
     */
    private Set<Integer> getVisibleMeshFaces(FrustumCorners frustum, MeshData mesh, Vector3 cameraPosition) {
        if (mesh == null || mesh.getVertices() == null || mesh.getVertices().isEmpty()) {
            return new HashSet<>();
        }

        List<Double> vertices = mesh.getVertices();
        List<Integer> indices = mesh.getIndices();

        int triCount = indices != null ? indices.size() / 3 : vertices.size() / 9;

        // 计算视锥体包围盒
        Box3 boxF = frustum.getBoundingBox();
        boxF.expandByScalar(0.5); // 扩大一点,避免浮点误差

        Set<Integer> visibleFaces = new HashSet<>();

        for (int i = 0; i < triCount; i++) {
            int i1, i2, i3;

            if (indices != null) {
                i1 = indices.get(i * 3);
                i2 = indices.get(i * 3 + 1);
                i3 = indices.get(i * 3 + 2);
            } else {
                i1 = i * 3;
                i2 = i * 3 + 1;
                i3 = i * 3 + 2;
            }

            Vector3 a = new Vector3(
                vertices.get(i1 * 3),
                vertices.get(i1 * 3 + 1),
                vertices.get(i1 * 3 + 2)
            );
            Vector3 b = new Vector3(
                vertices.get(i2 * 3),
                vertices.get(i2 * 3 + 1),
                vertices.get(i2 * 3 + 2)
            );
            Vector3 c = new Vector3(
                vertices.get(i3 * 3),
                vertices.get(i3 * 3 + 1),
                vertices.get(i3 * 3 + 2)
            );

            // 计算面的中心点
            Vector3 centroid = new Vector3();
            centroid.add(a).add(b).add(c).multiply(1.0 / 3.0);

            // 快速包围盒检测
            if (!boxF.containsPoint(centroid)) {
                continue;
            }

            // 检查面是否朝向相机
            Vector3 normal = Vector3.crossVectors(Vector3.subVectors(b, a), Vector3.subVectors(c, a));
            normal.normalize();

            Vector3 viewDir = Vector3.subVectors(cameraPosition, centroid);
            viewDir.normalize();

            if (normal.dot(viewDir) >= 0) {
                visibleFaces.add(i);
            }
        }

        return visibleFaces;
    }

    /**
     * 覆盖率指标数据类
     */
    public static class CoverageMetrics {
        public double coverage;       // 覆盖率(%)
        public double overlap;        // 重叠率(%)
        public double coveredArea;    // 覆盖面积
        public double overlapArea;    // 重叠面积

        public CoverageMetrics(double coverage, double overlap, double coveredArea, double overlapArea) {
            this.coverage = coverage;
            this.overlap = overlap;
            this.coveredArea = coveredArea;
            this.overlapArea = overlapArea;
        }
    }
}
