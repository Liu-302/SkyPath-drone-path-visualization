package com.skypath.backend.service;

import com.skypath.backend.dto.MeshData;
import com.skypath.backend.util.FrustumCalculator;
import com.skypath.backend.util.FrustumCorners;
import com.skypath.backend.util.Vector3;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * 视锥体高亮计算服务
 * 计算给定相机视角下建筑模型的可见面
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class FrustumHighlightService {

    @Data
    public static class HighlightResult {
        /** 可见面索引列表 */
        private int[] visibleFaceIndices;
        /** 可见面数量 */
        private int visibleFaceCount;
        /** 总面数量 */
        private int totalFaceCount;
        /** 覆盖率(0-1) */
        private double coverage;
        /** 计算耗时(毫秒) */
        private long calculationTime;
        /** 视锥体角点 */
        private FrustumCorners frustumCorners;
    }

    @Data
    public static class ViewpointRequest {
        private Vector3 position;
        private Vector3 direction;
        private Vector3 up;
        private double fov;
        private double aspect;
        private double near;
        private double far;
    }

    /**
     * 计算视锥体内可见的面
     */
    public HighlightResult calculateVisibleFaces(
            ViewpointRequest viewpoint,
            MeshData buildingMesh) {

        long startTime = System.currentTimeMillis();

        if (buildingMesh == null || buildingMesh.getVertices() == null) {
            throw new IllegalArgumentException("建筑模型数据为空");
        }

        // 计算视锥体角点
        FrustumCorners corners = FrustumCalculator.calculateFrustumCorners(
            viewpoint.getPosition(),
            viewpoint.getDirection(),
            viewpoint.getUp(),
            viewpoint.getFov(),
            viewpoint.getAspect(),
            viewpoint.getNear(),
            viewpoint.getFar()
        );

        // 检测可见面
        List<Integer> visibleFaces = detectVisibleFaces(corners, buildingMesh);

        // 计算覆盖率
        int totalFaces = calculateTotalFaces(buildingMesh);
        double coverage = totalFaces > 0 ? (double) visibleFaces.size() / totalFaces : 0.0;

        long calculationTime = System.currentTimeMillis() - startTime;

        log.info("Frustum highlight complete: {}/{} faces visible, coverage: {}%, elapsed: {}ms",
            visibleFaces.size(), totalFaces, String.format("%.2f", coverage * 100), calculationTime);

        HighlightResult result = new HighlightResult();
        result.setVisibleFaceIndices(visibleFaces.stream().mapToInt(i -> i).toArray());
        result.setVisibleFaceCount(visibleFaces.size());
        result.setTotalFaceCount(totalFaces);
        result.setCoverage(coverage);
        result.setCalculationTime(calculationTime);
        result.setFrustumCorners(corners);

        return result;
    }

    /**
     * 批量预计算所有视点的可见面
     */
    public Map<Integer, HighlightResult> precalculateAllViewpoints(
            List<ViewpointRequest> viewpoints,
            MeshData buildingMesh) {

        log.info("Precomputing visible faces for {} viewpoints...", viewpoints.size());

        Map<Integer, HighlightResult> results = new HashMap<>();

        for (int i = 0; i < viewpoints.size(); i++) {
            try {
                HighlightResult result = calculateVisibleFaces(viewpoints.get(i), buildingMesh);
                results.put(i, result);
            } catch (Exception e) {
                log.error("Failed to compute viewpoint {}", i, e);
            }
        }

        log.info("Precompute complete, success: {}/{}", results.size(), viewpoints.size());

        return results;
    }

    /**
     * 检测可见面(使用包围盒和中心点判断)
     */
    private List<Integer> detectVisibleFaces(
            FrustumCorners corners,
            MeshData mesh) {

        List<Double> vertices = mesh.getVertices();
        List<Integer> indices = mesh.getIndices();

        if (indices == null || indices.isEmpty()) {
            return Collections.emptyList();
        }

        List<Integer> visibleFaces = new ArrayList<>();
        int triCount = indices.size() / 3;

        // 构建视锥体包围盒
        List<Vector3> frustumVertices = new ArrayList<>();
        for (var v : corners.near) {
            frustumVertices.add(v);
        }
        for (var v : corners.far) {
            frustumVertices.add(v);
        }

        // 扩大一点包围盒,避免浮点误差
        float[] frustumBounds = calculateBoundingBoxWithPadding(frustumVertices, 0.5f);

        for (int i = 0; i < triCount; i++) {
            int aIdx = indices.get(i * 3);
            int bIdx = indices.get(i * 3 + 1);
            int cIdx = indices.get(i * 3 + 2);

            // 获取三角形三个顶点
            Vector3 a = getVertex(vertices, aIdx);
            Vector3 b = getVertex(vertices, bIdx);
            Vector3 c = getVertex(vertices, cIdx);

            // 计算三角形中心点
            Vector3 center = new Vector3(
                (a.x + b.x + c.x) / 3.0,
                (a.y + b.y + c.y) / 3.0,
                (a.z + b.z + c.z) / 3.0
            );

            // 检查中心点是否在视锥体包围盒内
            if (isPointInBoundingBox(center, frustumBounds)) {
                // 进一步检查: 使用平面判断
                if (isPointInFrustum(center, corners)) {
                    visibleFaces.add(i);
                }
            }
        }

        return visibleFaces;
    }

    /**
     * 检查点是否在视锥体内(使用平面方程)
     */
    private boolean isPointInFrustum(Vector3 point, FrustumCorners corners) {
        // 近平面判断
        Vector3 nearNormal = calculatePlaneNormal(corners.near[0], corners.near[1], corners.near[2]);
        double nearDist = dotProduct(subtractVectors(point, corners.near[0]), nearNormal);
        if (nearDist < 0) return false;

        // 远平面判断
        Vector3 farNormal = calculatePlaneNormal(corners.far[2], corners.far[1], corners.far[0]);
        double farDist = dotProduct(subtractVectors(point, corners.far[0]), farNormal);
        if (farDist < 0) return false;

        // 简化处理: 如果通过近远平面,认为在视锥体内
        // 精确实现需要计算6个平面的方程
        return true;
    }

    /**
     * 计算总面数量
     */
    private int calculateTotalFaces(MeshData mesh) {
        if (mesh.getIndices() == null || mesh.getIndices().isEmpty()) {
            return mesh.getVertices() != null ? mesh.getVertices().size() / 3 : 0;
        }
        return mesh.getIndices().size() / 3;
    }

    /**
     * 计算包围盒(带padding)
     */
    private float[] calculateBoundingBoxWithPadding(List<Vector3> vertices, float padding) {
        float minX = Float.MAX_VALUE, minY = Float.MAX_VALUE, minZ = Float.MAX_VALUE;
        float maxX = Float.MIN_VALUE, maxY = Float.MIN_VALUE, maxZ = Float.MIN_VALUE;

        for (Vector3 v : vertices) {
            minX = Math.min(minX, (float) v.x);
            minY = Math.min(minY, (float) v.y);
            minZ = Math.min(minZ, (float) v.z);
            maxX = Math.max(maxX, (float) v.x);
            maxY = Math.max(maxY, (float) v.y);
            maxZ = Math.max(maxZ, (float) v.z);
        }

        return new float[]{
            minX - padding, minY - padding, minZ - padding,
            maxX + padding, maxY + padding, maxZ + padding
        };
    }

    /**
     * 检查点是否在包围盒内
     */
    private boolean isPointInBoundingBox(Vector3 point, float[] bounds) {
        return point.x >= bounds[0] && point.x <= bounds[3] &&
               point.y >= bounds[1] && point.y <= bounds[4] &&
               point.z >= bounds[2] && point.z <= bounds[5];
    }

    /**
     * 从顶点列表中获取顶点
     */
    private Vector3 getVertex(List<Double> vertices, int index) {
        int idx = index * 3;
        return new Vector3(vertices.get(idx), vertices.get(idx + 1), vertices.get(idx + 2));
    }

    /**
     * 向量减法
     */
    private Vector3 subtractVectors(Vector3 a, Vector3 b) {
        return new Vector3(a.x - b.x, a.y - b.y, a.z - b.z);
    }

    /**
     * 点积
     */
    private double dotProduct(Vector3 a, Vector3 b) {
        return a.x * b.x + a.y * b.y + a.z * b.z;
    }

    /**
     * 计算平面法线
     */
    private Vector3 calculatePlaneNormal(Vector3 a, Vector3 b, Vector3 c) {
        Vector3 ab = subtractVectors(b, a);
        Vector3 ac = subtractVectors(c, a);
        Vector3 normal = crossProduct(ab, ac);
        return normalize(normal);
    }

    /**
     * 叉积
     */
    private Vector3 crossProduct(Vector3 a, Vector3 b) {
        return new Vector3(
            a.y * b.z - a.z * b.y,
            a.z * b.x - a.x * b.z,
            a.x * b.y - a.y * b.x
        );
    }

    /**
     * 归一化
     */
    private Vector3 normalize(Vector3 v) {
        double length = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
        if (length < 1e-9) {
            return new Vector3(0, 0, 0);
        }
        return new Vector3(v.x / length, v.y / length, v.z / length);
    }
}
