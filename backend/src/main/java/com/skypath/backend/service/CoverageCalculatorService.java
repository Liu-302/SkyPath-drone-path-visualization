package com.skypath.backend.service;

import com.skypath.backend.dto.WaypointData;
import com.skypath.backend.dto.MeshData;
import com.skypath.backend.util.*;
import lombok.extern.slf4j.Slf4j;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.IntStream;

/**
 * 覆盖范围计算服务
 * 对应前端的coverage-calculator.ts
 */
@Service
@Slf4j
public class CoverageCalculatorService {

    // =======================
    // Camera / pyramid params
    // =======================
    // 说明：
    // - 本服务的“可见/覆盖”判定使用“四棱锥 + 四面体包含测试”（更接近论文/图片方法）
    // - 方向优先使用 WaypointData.normalX/Y/Z（来自前端上传的 JSON）
    // - h 使用“相机沿方向射线与建筑网格最近相交距离”的动态值（每个视点一个 h）
    //
    // 你可以按无人机真实相机参数修改下列 HFOV/VFOV（单位：度）。
    // 若不修改，将从默认 VFOV + ASPECT 推导 HFOV。
    private static final double CAMERA_ASPECT = 16.0 / 9.0;
    /** 默认 VFOV（度）- 与前端 CAMERA_CONFIG 一致，Phantom 4 Pro 对角线 FOV 84° 换算垂直 FOV≈53.1° */
    private static final double DEFAULT_VFOV_DEG = 53.1;
    /** 默认 HFOV（度）。若未手动配置，将由 VFOV + aspect 推导 */
    private static final double DEFAULT_HFOV_DEG = vfovToHfov(DEFAULT_VFOV_DEG, CAMERA_ASPECT);

    /** 覆盖判定：当 normal 缺失/无效时使用的最大距离兜底（单位同模型/航点坐标） */
    private static final double FALLBACK_H = 1000.0;
    /** 四面体包含测试的容差（浮点误差） */
    private static final double INSIDE_EPS = 1e-9;
    /** 视锥半空间裁剪容差（浮点误差） */
    private static final double CLIP_EPS = 1e-9;
    /** 射线三角形相交：忽略过近的命中 */
    private static final double RAY_T_EPS = 1e-6;

    /**
     * 计算路径覆盖/重叠指标
     * 对应前端的calculatePathCoverageMetrics
     */
    public CoverageMetrics calculatePathCoverageMetrics(List<WaypointData> pathPoints, MeshData buildingMesh) {
        if (pathPoints == null || pathPoints.isEmpty()) {
            log.warn("Path points empty, cannot compute coverage");
            return new CoverageMetrics(0, 0, 0, 0);
        }

        if (buildingMesh == null || buildingMesh.getVertices() == null || buildingMesh.getVertices().isEmpty()) {
            log.warn("Invalid building model, cannot compute coverage");
            return new CoverageMetrics(0, 0, 0, 0);
        }

        // 计算建筑物总面积
        double totalArea = calculateTotalBuildingArea(buildingMesh);
        if (totalArea <= 0) {
            log.warn("Building model area is 0, cannot compute coverage");
            return new CoverageMetrics(0, 0, 0, 0);
        }

        // 统计每个面的覆盖次数 - 使用 ConcurrentHashMap 支持并发写入
        Map<Integer, Integer> faceCoverageMap = new ConcurrentHashMap<>();

        // 预先计算建筑物中心点和包围盒（避免在每个线程中重复计算）
        Vector3 buildingCenter = extractMeshCenter(buildingMesh);
        Box3 meshBounds = calculateMeshBoundingBox(buildingMesh);

        // 使用并行流处理路径点，提高计算效率
        int pathPointCount = pathPoints.size();
        log.info("Starting parallel coverage calculation: pathPointCount={}, using multi-threading", pathPointCount);

        IntStream.range(0, pathPointCount).parallel().forEach(i -> {
            WaypointData point = pathPoints.get(i);
            Vector3 position = new Vector3(point.getX(), point.getY(), point.getZ());

            // 1) 方向：优先用 JSON/WaypointData 中的 normal（相机光轴朝向）
            Vector3 direction = getDirectionFromWaypoint(point, buildingCenter, position);

            // 2) 动态 h：相机位置沿 direction 发射射线，与建筑网格最近相交距离
            double h = computeDynamicH(position, direction, buildingMesh, meshBounds);
            if (!(h > 0)) {
                h = FALLBACK_H;
            }

            // 3) 构造四棱锥（apex + base 4 corners），再用四面体包含测试筛可见面
            Pyramid pyramid = buildPyramid(position, direction, DEFAULT_HFOV_DEG, DEFAULT_VFOV_DEG, h);

            // 获取可见面（四棱锥包含 + 朝向）
            Set<Integer> visibleFaces = getVisibleMeshFacesByPyramid(pyramid, buildingMesh, position);

            // 线程安全地统计覆盖次数
            for (int faceIndex : visibleFaces) {
                faceCoverageMap.merge(faceIndex, 1, Integer::sum);
            }
        });

        log.info("Parallel calculation complete: covered face count={}", faceCoverageMap.size());

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
     * 增量计算每个航点数的累计覆盖率，用于播放预加载，与 KPI Coverage Rate 完全一致
     * @return waypointCount -> coverage (0-100%)
     */
    public java.util.Map<Integer, Double> calculateCoverageByWaypointCount(
            List<WaypointData> pathPoints, MeshData buildingMesh) {
        java.util.Map<Integer, Double> result = new java.util.HashMap<>();
        if (pathPoints == null || pathPoints.isEmpty() || buildingMesh == null
                || buildingMesh.getVertices() == null || buildingMesh.getVertices().isEmpty()) {
            return result;
        }
        double totalArea = calculateTotalBuildingArea(buildingMesh);
        if (totalArea <= 0) return result;

        Vector3 buildingCenter = extractMeshCenter(buildingMesh);
        Box3 meshBounds = calculateMeshBoundingBox(buildingMesh);
        java.util.Set<Integer> coveredFaces = new java.util.HashSet<>();

        for (int i = 0; i < pathPoints.size(); i++) {
            WaypointData point = pathPoints.get(i);
            Vector3 position = new Vector3(point.getX(), point.getY(), point.getZ());
            Vector3 direction = getDirectionFromWaypoint(point, buildingCenter, position);
            double h = computeDynamicH(position, direction, buildingMesh, meshBounds);
            if (!(h > 0)) h = FALLBACK_H;
            Pyramid pyramid = buildPyramid(position, direction, DEFAULT_HFOV_DEG, DEFAULT_VFOV_DEG, h);
            java.util.Set<Integer> visible = getVisibleMeshFacesByPyramid(pyramid, buildingMesh, position);
            coveredFaces.addAll(visible);

            if (i >= 1) {
                double coveredArea = 0;
                for (int fi : coveredFaces) {
                    coveredArea += calculateFaceArea(buildingMesh, fi);
                }
                double pct = totalArea > 0 ? (coveredArea / totalArea) * 100 : 0;
                result.put(i + 1, Math.max(0, Math.min(100, pct)));
            }
        }
        return result;
    }

    /**
     * 单航点覆盖/重叠指标（用于面板详情）
     * - coverage：当前航点视点覆盖率（%）
     * - overlapWithPrevious：与前一航点视点的重叠率（%）；index==0 时为 null
     *
     * 视锥构造：四棱锥 + 动态 h + 使用航点 normal（与整体覆盖/重叠口径一致）
     */
    public ViewpointMetrics calculateViewpointMetrics(List<WaypointData> pathPoints, MeshData buildingMesh, int index) {
        if (pathPoints == null || pathPoints.isEmpty()) {
            throw new IllegalArgumentException("路径点为空，无法计算视点指标");
        }
        if (index < 0 || index >= pathPoints.size()) {
            throw new IllegalArgumentException("视点索引无效: " + index);
        }
        if (buildingMesh == null || buildingMesh.getVertices() == null || buildingMesh.getVertices().isEmpty()) {
            // 与整体KPI一致：没有模型时不可计算
            return new ViewpointMetrics(null, null);
        }

        double totalArea = calculateTotalBuildingArea(buildingMesh);
        if (!(totalArea > 0)) {
            return new ViewpointMetrics(null, null);
        }

        Vector3 buildingCenter = extractMeshCenter(buildingMesh);
        Box3 meshBounds = calculateMeshBoundingBox(buildingMesh);

        // 当前视点
        WaypointData curr = pathPoints.get(index);
        Vector3 currPos = new Vector3(curr.getX(), curr.getY(), curr.getZ());
        Vector3 currDir = getDirectionFromWaypoint(curr, buildingCenter, currPos);
        double currH = computeDynamicH(currPos, currDir, buildingMesh, meshBounds);
        if (!(currH > 0)) currH = FALLBACK_H;
        Pyramid currPyramid = buildPyramid(currPos, currDir, DEFAULT_HFOV_DEG, DEFAULT_VFOV_DEG, currH);
        Set<Integer> currVisible = getVisibleMeshFacesByPyramid(currPyramid, buildingMesh, currPos);

        double coveredArea = 0.0;
        for (int faceIndex : currVisible) {
            coveredArea += calculateFaceArea(buildingMesh, faceIndex);
        }
        double coveragePct = (coveredArea / totalArea) * 100.0;

        // 与前一视点重叠：与整体 Overlap Rate 使用相同算法
        // 公式统一：重叠面积 / 建筑总面积 × 100%
        // - 整体：overlapArea = 被 2+ 视点覆盖的面之和
        // - 单帧：intersectionArea = 被当前帧与前一帧共同覆盖的面之和
        Double overlapPct = null;
        if (index > 0) {
            WaypointData prev = pathPoints.get(index - 1);
            Vector3 prevPos = new Vector3(prev.getX(), prev.getY(), prev.getZ());
            Vector3 prevDir = getDirectionFromWaypoint(prev, buildingCenter, prevPos);
            double prevH = computeDynamicH(prevPos, prevDir, buildingMesh, meshBounds);
            if (!(prevH > 0)) prevH = FALLBACK_H;
            Pyramid prevPyramid = buildPyramid(prevPos, prevDir, DEFAULT_HFOV_DEG, DEFAULT_VFOV_DEG, prevH);
            Set<Integer> prevVisible = getVisibleMeshFacesByPyramid(prevPyramid, buildingMesh, prevPos);

            double intersectionArea = 0.0;
            Set<Integer> small = currVisible.size() <= prevVisible.size() ? currVisible : prevVisible;
            Set<Integer> large = small == currVisible ? prevVisible : currVisible;
            for (int faceIndex : small) {
                if (large.contains(faceIndex)) {
                    intersectionArea += calculateFaceArea(buildingMesh, faceIndex);
                }
            }
            overlapPct = (intersectionArea / totalArea) * 100.0;
        }

        return new ViewpointMetrics(coveragePct, overlapPct);
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
     * 获取四棱锥（视锥）内可见的网格面
     *
     * 判定逻辑（方案A，高亮更贴近线框边界）：
     * - 三角形与“有限四棱锥”有相交（将三角形按四棱锥的 5 个半空间裁剪，裁剪结果非空）
     * - 且三角面朝向相机（normal · viewDir >= 0）
     */
    private Set<Integer> getVisibleMeshFacesByPyramid(Pyramid pyramid, MeshData mesh, Vector3 cameraPosition) {
        if (mesh == null || mesh.getVertices() == null || mesh.getVertices().isEmpty()) {
            return new HashSet<>();
        }

        List<Double> vertices = mesh.getVertices();
        List<Integer> indices = mesh.getIndices();

        int triCount = indices != null ? indices.size() / 3 : vertices.size() / 9;
        // 用四棱锥的包围盒做一次粗筛（减少后续四面体测试开销）
        Box3 boxF = pyramid.getBoundingBox();
        boxF.expandByScalar(0.5);

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

            // 快速包围盒检测：三角形包围盒与视锥包围盒不相交则跳过
            Box3 triBox = new Box3();
            triBox.expandByPoint(a).expandByPoint(b).expandByPoint(c);
            if (!triBox.intersectsBox(boxF)) {
                continue;
            }

            // 计算质心（用于相交测试和朝向判断）
            Vector3 centroid = new Vector3();
            centroid.add(a).add(b).add(c).multiply(1.0 / 3.0);

            // 方案A：三角形与有限四棱锥相交
            // 快速路径：质心在四棱锥内则必然相交；否则用半空间裁剪
            if (!isPointInsidePyramid(centroid, pyramid) && !triangleIntersectsPyramid(a, b, c, pyramid)) {
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

    // =======================
    // Triangle vs pyramid (half-space clipping) - Plan A
    // =======================

    private static class Plane {
        Vector3 n;      // normalized
        double d;       // plane constant in n·x + d = 0

        double signedDistance(Vector3 p) {
            return n.dot(p) + d;
        }
    }

    /**
     * Triangle intersects finite pyramid if clipping the triangle by the pyramid's half-spaces is non-empty.
     */
    private boolean triangleIntersectsPyramid(Vector3 a, Vector3 b, Vector3 c, Pyramid pyramid) {
        List<Plane> planes = buildPyramidHalfSpaces(pyramid);
        // start polygon as triangle
        List<Vector3> poly = new ArrayList<>(3);
        poly.add(a);
        poly.add(b);
        poly.add(c);

        for (Plane plane : planes) {
            poly = clipPolygonAgainstPlane(poly, plane);
            if (poly.isEmpty()) {
                return false;
            }
        }
        return true;
    }

    private List<Plane> buildPyramidHalfSpaces(Pyramid pyramid) {
        Vector3 v = pyramid.apex;
        Vector3 b1 = pyramid.base[0];
        Vector3 b2 = pyramid.base[1];
        Vector3 b3 = pyramid.base[2];
        Vector3 b4 = pyramid.base[3];

        // An interior point for orientation (average of apex + base corners)
        Vector3 interior = new Vector3(v);
        interior.add(b1).add(b2).add(b3).add(b4).multiply(1.0 / 5.0);

        List<Plane> planes = new ArrayList<>(5);
        // 4 side faces
        planes.add(planeFromPoints(v, b1, b2, interior));
        planes.add(planeFromPoints(v, b2, b3, interior));
        planes.add(planeFromPoints(v, b3, b4, interior));
        planes.add(planeFromPoints(v, b4, b1, interior));
        // base cap (finite pyramid)
        planes.add(planeFromPoints(b1, b2, b3, interior));
        return planes;
    }

    private Plane planeFromPoints(Vector3 p0, Vector3 p1, Vector3 p2, Vector3 interior) {
        Vector3 e1 = Vector3.subVectors(p1, p0);
        Vector3 e2 = Vector3.subVectors(p2, p0);
        Vector3 n = Vector3.crossVectors(e1, e2);
        double len = n.length();
        if (len > 0) {
            n.multiply(1.0 / len);
        }
        double d = -n.dot(p0);

        // ensure interior is on the inside side: n·x + d >= 0
        if (n.dot(interior) + d < 0) {
            n.multiply(-1.0);
            d = -d;
        }

        Plane plane = new Plane();
        plane.n = n;
        plane.d = d;
        return plane;
    }

    /**
     * Sutherland–Hodgman clipping of a convex polygon against a plane half-space n·x + d >= 0.
     */
    private List<Vector3> clipPolygonAgainstPlane(List<Vector3> input, Plane plane) {
        if (input == null || input.isEmpty()) return Collections.emptyList();

        List<Vector3> output = new ArrayList<>(input.size() + 4);
        int n = input.size();
        for (int i = 0; i < n; i++) {
            Vector3 s = input.get(i);
            Vector3 e = input.get((i + 1) % n);

            double ds = plane.signedDistance(s);
            double de = plane.signedDistance(e);
            boolean sInside = ds >= -CLIP_EPS;
            boolean eInside = de >= -CLIP_EPS;

            if (sInside && eInside) {
                // keep end point
                output.add(e);
            } else if (sInside && !eInside) {
                // leaving: add intersection
                Vector3 isect = segmentPlaneIntersection(s, e, ds, de);
                if (isect != null) output.add(isect);
            } else if (!sInside && eInside) {
                // entering: add intersection + end
                Vector3 isect = segmentPlaneIntersection(s, e, ds, de);
                if (isect != null) output.add(isect);
                output.add(e);
            } else {
                // outside -> add nothing
            }
        }
        return output;
    }

    private Vector3 segmentPlaneIntersection(Vector3 s, Vector3 e, double ds, double de) {
        double denom = (ds - de);
        if (Math.abs(denom) < 1e-18) {
            return null;
        }
        double t = ds / denom; // ds + t*(de-ds) == 0  => t = ds/(ds-de)
        t = Math.max(0.0, Math.min(1.0, t));
        return new Vector3(
            s.x + (e.x - s.x) * t,
            s.y + (e.y - s.y) * t,
            s.z + (e.z - s.z) * t
        );
    }

    // =======================
    // Direction / dynamic h
    // =======================

    private Vector3 getDirectionFromWaypoint(WaypointData point, Vector3 buildingCenter, Vector3 cameraPosition) {
        try {
            Double nx = point.getNormalX();
            Double ny = point.getNormalY();
            Double nz = point.getNormalZ();
            if (nx != null && ny != null && nz != null) {
                Vector3 n = new Vector3(nx, ny, nz);
                if (n.length() > 1e-6) {
                    return n.normalize();
                }
            }
        } catch (Exception ignored) {
            // fall back below
        }

        // 兜底：如果 normal 不可用，则仍然朝向建筑中心（与旧实现一致）
        Vector3 cameraToBuilding = Vector3.subVectors(buildingCenter, cameraPosition);
        return cameraToBuilding.normalize();
    }

    /**
     * 动态 h：相机沿 direction 发射射线，与建筑三角网格最近相交距离（t 的最小正值）
     */
    private double computeDynamicH(Vector3 origin, Vector3 direction, MeshData mesh, Box3 meshBounds) {
        if (mesh == null || mesh.getVertices() == null || mesh.getVertices().isEmpty()) return FALLBACK_H;
        if (meshBounds != null && !rayIntersectsAabb(origin, direction, meshBounds)) {
            return FALLBACK_H;
        }

        List<Double> vertices = mesh.getVertices();
        List<Integer> indices = mesh.getIndices();
        int triCount = indices != null ? indices.size() / 3 : vertices.size() / 9;

        double bestT = Double.POSITIVE_INFINITY;

        for (int i = 0; i < triCount; i++) {
            Vector3 a, b, c;
            if (indices != null) {
                int i1 = indices.get(i * 3);
                int i2 = indices.get(i * 3 + 1);
                int i3 = indices.get(i * 3 + 2);
                a = new Vector3(vertices.get(i1 * 3), vertices.get(i1 * 3 + 1), vertices.get(i1 * 3 + 2));
                b = new Vector3(vertices.get(i2 * 3), vertices.get(i2 * 3 + 1), vertices.get(i2 * 3 + 2));
                c = new Vector3(vertices.get(i3 * 3), vertices.get(i3 * 3 + 1), vertices.get(i3 * 3 + 2));
            } else {
                int base = i * 9;
                a = new Vector3(vertices.get(base), vertices.get(base + 1), vertices.get(base + 2));
                b = new Vector3(vertices.get(base + 3), vertices.get(base + 4), vertices.get(base + 5));
                c = new Vector3(vertices.get(base + 6), vertices.get(base + 7), vertices.get(base + 8));
            }

            double t = rayTriangleIntersect(origin, direction, a, b, c);
            if (t > RAY_T_EPS && t < bestT) {
                bestT = t;
            }
        }

        return Double.isFinite(bestT) ? bestT : FALLBACK_H;
    }

    /**
     * Ray vs triangle intersection (Möller–Trumbore).
     * @return t along ray (origin + t*dir) if hit, otherwise +INF
     */
    private double rayTriangleIntersect(Vector3 origin, Vector3 dir, Vector3 v0, Vector3 v1, Vector3 v2) {
        Vector3 edge1 = Vector3.subVectors(v1, v0);
        Vector3 edge2 = Vector3.subVectors(v2, v0);

        Vector3 pvec = Vector3.crossVectors(dir, edge2);
        double det = edge1.dot(pvec);
        if (Math.abs(det) < 1e-12) {
            return Double.POSITIVE_INFINITY;
        }

        double invDet = 1.0 / det;
        Vector3 tvec = Vector3.subVectors(origin, v0);
        double u = tvec.dot(pvec) * invDet;
        if (u < 0.0 || u > 1.0) return Double.POSITIVE_INFINITY;

        Vector3 qvec = Vector3.crossVectors(tvec, edge1);
        double v = dir.dot(qvec) * invDet;
        if (v < 0.0 || u + v > 1.0) return Double.POSITIVE_INFINITY;

        double t = edge2.dot(qvec) * invDet;
        return t > 0 ? t : Double.POSITIVE_INFINITY;
    }

    /**
     * Quick ray vs AABB slab test.
     */
    private boolean rayIntersectsAabb(Vector3 origin, Vector3 dir, Box3 box) {
        double tmin = Double.NEGATIVE_INFINITY;
        double tmax = Double.POSITIVE_INFINITY;

        // X
        if (Math.abs(dir.x) < 1e-12) {
            if (origin.x < box.min.x || origin.x > box.max.x) return false;
        } else {
            double inv = 1.0 / dir.x;
            double t1 = (box.min.x - origin.x) * inv;
            double t2 = (box.max.x - origin.x) * inv;
            if (t1 > t2) { double tmp = t1; t1 = t2; t2 = tmp; }
            tmin = Math.max(tmin, t1);
            tmax = Math.min(tmax, t2);
            if (tmax < tmin) return false;
        }

        // Y
        if (Math.abs(dir.y) < 1e-12) {
            if (origin.y < box.min.y || origin.y > box.max.y) return false;
        } else {
            double inv = 1.0 / dir.y;
            double t1 = (box.min.y - origin.y) * inv;
            double t2 = (box.max.y - origin.y) * inv;
            if (t1 > t2) { double tmp = t1; t1 = t2; t2 = tmp; }
            tmin = Math.max(tmin, t1);
            tmax = Math.min(tmax, t2);
            if (tmax < tmin) return false;
        }

        // Z
        if (Math.abs(dir.z) < 1e-12) {
            if (origin.z < box.min.z || origin.z > box.max.z) return false;
        } else {
            double inv = 1.0 / dir.z;
            double t1 = (box.min.z - origin.z) * inv;
            double t2 = (box.max.z - origin.z) * inv;
            if (t1 > t2) { double tmp = t1; t1 = t2; t2 = tmp; }
            tmin = Math.max(tmin, t1);
            tmax = Math.min(tmax, t2);
            return tmax >= tmin;
        }

        return true;
    }

    private Box3 calculateMeshBoundingBox(MeshData mesh) {
        if (mesh == null || mesh.getVertices() == null || mesh.getVertices().isEmpty()) return null;
        Box3 box = new Box3();
        List<Double> v = mesh.getVertices();
        int vc = v.size() / 3;
        for (int i = 0; i < vc; i++) {
            box.expandByPoint(new Vector3(v.get(i * 3), v.get(i * 3 + 1), v.get(i * 3 + 2)));
        }
        return box;
    }

    // =======================
    // Pyramid (4-sided) logic
    // =======================

    private static double vfovToHfov(double vfovDeg, double aspect) {
        double vfovRad = Math.toRadians(vfovDeg);
        double hfovRad = 2.0 * Math.atan(Math.tan(vfovRad / 2.0) * aspect);
        return Math.toDegrees(hfovRad);
    }

    private static class Pyramid {
        Vector3 apex;      // v
        Vector3[] base;    // b1..b4

        Box3 getBoundingBox() {
            Box3 b = new Box3();
            b.expandByPoint(apex);
            for (Vector3 p : base) b.expandByPoint(p);
            return b;
        }
    }

    /**
     * 根据 (v, d, HFOV, VFOV, h) 构造有限四棱锥：
     * apex = v
     * base center c = v + h*d
     * base size w/l = 2h*tan(FOV/2)
     */
    private Pyramid buildPyramid(Vector3 v, Vector3 d, double hfovDeg, double vfovDeg, double h) {
        Vector3 dir = d.clone().normalize();

        // choose a stable worldUp
        Vector3 worldUp = new Vector3(0, 1, 0);
        if (Math.abs(dir.dot(worldUp)) > 0.98) {
            worldUp = new Vector3(0, 0, 1);
        }

        // right = normalize(dir x worldUp)
        Vector3 right = Vector3.crossVectors(dir, worldUp);
        right.normalize();

        // up = normalize(right x dir)  (ensures orthonormal basis)
        Vector3 up = Vector3.crossVectors(right, dir);
        up.normalize();

        double hfovRad = Math.toRadians(hfovDeg);
        double vfovRad = Math.toRadians(vfovDeg);
        double halfW = Math.tan(hfovRad / 2.0) * h;
        double halfL = Math.tan(vfovRad / 2.0) * h;

        Vector3 c = new Vector3(v.x + dir.x * h, v.y + dir.y * h, v.z + dir.z * h);

        Vector3 b1 = new Vector3(
            c.x + right.x * halfW + up.x * halfL,
            c.y + right.y * halfW + up.y * halfL,
            c.z + right.z * halfW + up.z * halfL
        );
        Vector3 b2 = new Vector3(
            c.x - right.x * halfW + up.x * halfL,
            c.y - right.y * halfW + up.y * halfL,
            c.z - right.z * halfW + up.z * halfL
        );
        Vector3 b3 = new Vector3(
            c.x - right.x * halfW - up.x * halfL,
            c.y - right.y * halfW - up.y * halfL,
            c.z - right.z * halfW - up.z * halfL
        );
        Vector3 b4 = new Vector3(
            c.x + right.x * halfW - up.x * halfL,
            c.y + right.y * halfW - up.y * halfL,
            c.z + right.z * halfW - up.z * halfL
        );

        Pyramid p = new Pyramid();
        p.apex = v;
        p.base = new Vector3[]{ b1, b2, b3, b4 };
        return p;
    }

    private boolean isPointInsidePyramid(Vector3 p, Pyramid pyramid) {
        Vector3 v = pyramid.apex;
        Vector3 b1 = pyramid.base[0];
        Vector3 b2 = pyramid.base[1];
        Vector3 b3 = pyramid.base[2];
        Vector3 b4 = pyramid.base[3];

        // split pyramid into 2 tetrahedra along diagonal (b1-b3)
        return isPointInsideTetrahedron(p, v, b1, b2, b3) || isPointInsideTetrahedron(p, v, b1, b3, b4);
    }

    /**
     * Tetrahedron inclusion via barycentric coordinates using determinants:
     * Solve p-v = beta(a-v) + gamma(b-v) + delta(c-v)
     * alpha = 1 - beta - gamma - delta
     */
    private boolean isPointInsideTetrahedron(Vector3 p, Vector3 v, Vector3 a, Vector3 b, Vector3 c) {
        Vector3 pv = Vector3.subVectors(p, v);
        Vector3 av = Vector3.subVectors(a, v);
        Vector3 bv = Vector3.subVectors(b, v);
        Vector3 cv = Vector3.subVectors(c, v);

        double detM = det3(av, bv, cv);
        if (Math.abs(detM) < 1e-18) {
            return false;
        }

        double beta = det3(pv, bv, cv) / detM;
        double gamma = det3(av, pv, cv) / detM;
        double delta = det3(av, bv, pv) / detM;
        double alpha = 1.0 - beta - gamma - delta;

        return alpha >= -INSIDE_EPS && beta >= -INSIDE_EPS && gamma >= -INSIDE_EPS && delta >= -INSIDE_EPS
            && alpha <= 1 + INSIDE_EPS && beta <= 1 + INSIDE_EPS && gamma <= 1 + INSIDE_EPS && delta <= 1 + INSIDE_EPS;
    }

    // det([a b c]) = a · (b × c)
    private double det3(Vector3 a, Vector3 b, Vector3 c) {
        Vector3 bxC = Vector3.crossVectors(b, c);
        return a.dot(bxC);
    }

    /**
     * 播放模式高亮：计算已飞过视点与当前视点的可见面索引
     * 用于前端建筑高亮（绿色=过去，橙色=当前）
     */
    public PlaybackHighlightResult computePlaybackHighlight(
            List<WaypointData> pastViewpoints,
            WaypointData currentViewpoint,
            MeshData buildingMesh) {
        if (buildingMesh == null || buildingMesh.getVertices() == null || buildingMesh.getVertices().isEmpty()) {
            return new PlaybackHighlightResult(new int[0], new int[0]);
        }

        Vector3 buildingCenter = extractMeshCenter(buildingMesh);
        Box3 meshBounds = calculateMeshBoundingBox(buildingMesh);

        Set<Integer> pastFaces = new HashSet<>();
        Set<Integer> currentFaces = new HashSet<>();

        if (pastViewpoints != null) {
            for (WaypointData point : pastViewpoints) {
                Vector3 pos = new Vector3(point.getX(), point.getY(), point.getZ());
                Vector3 dir = getDirectionFromWaypoint(point, buildingCenter, pos);
                double h = computeDynamicH(pos, dir, buildingMesh, meshBounds);
                if (!(h > 0)) h = FALLBACK_H;
                Pyramid pyramid = buildPyramid(pos, dir, DEFAULT_HFOV_DEG, DEFAULT_VFOV_DEG, h);
                Set<Integer> visible = getVisibleMeshFacesByPyramid(pyramid, buildingMesh, pos);
                pastFaces.addAll(visible);
            }
        }

        if (currentViewpoint != null) {
            Vector3 pos = new Vector3(currentViewpoint.getX(), currentViewpoint.getY(), currentViewpoint.getZ());
            Vector3 dir = getDirectionFromWaypoint(currentViewpoint, buildingCenter, pos);
            double h = computeDynamicH(pos, dir, buildingMesh, meshBounds);
            if (!(h > 0)) h = FALLBACK_H;
            Pyramid pyramid = buildPyramid(pos, dir, DEFAULT_HFOV_DEG, DEFAULT_VFOV_DEG, h);
            Set<Integer> visible = getVisibleMeshFacesByPyramid(pyramid, buildingMesh, pos);
            currentFaces.addAll(visible);
        }

        int[] pastArr = pastFaces.stream().mapToInt(i -> i).toArray();
        int[] currentArr = currentFaces.stream().mapToInt(i -> i).toArray();
        return new PlaybackHighlightResult(pastArr, currentArr);
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PlaybackHighlightResult {
        private int[] pastFaceIndices;
        private int[] currentFaceIndices;
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

    /**
     * 单视点指标（百分比）
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ViewpointMetrics {
        /** %，null 表示不可计算 */
        private Double coverage;
        /** %，null 表示不可计算/无上一帧 */
        private Double overlapWithPrevious;
    }
}
