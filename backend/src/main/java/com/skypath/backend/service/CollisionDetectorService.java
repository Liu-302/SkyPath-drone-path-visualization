package com.skypath.backend.service;

import com.skypath.backend.dto.WaypointData;
import com.skypath.backend.dto.MeshData;
import com.skypath.backend.dto.CollisionPoint;
import com.skypath.backend.util.Vector3;
import com.skypath.backend.util.Box3;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * 碰撞检测服务
 * 使用三角面体素化 + 3D DDA (Amanatides & Woo) 进行精确碰撞检测
 * 替代原先的立方体（AABB）包围盒近似检测
 */
@Service
@Slf4j
public class CollisionDetectorService {

    /** 体素网格分辨率（每轴） */
    private static final int GRID_RES = 64;

    /**
     * 检测路径与建筑物的碰撞
     * 三角面体素化 + 3D DDA 线段碰撞
     */
    public CollisionResult detectPathCollisions(List<WaypointData> pathPoints, MeshData buildingMesh) {
        if (pathPoints == null || pathPoints.isEmpty() || buildingMesh == null || buildingMesh.getVertices() == null) {
            return new CollisionResult(0, false, new ArrayList<>());
        }

        Box3 bbox = extractBoundingBox(buildingMesh);
        if (bbox == null || bbox.isEmpty()) {
            return new CollisionResult(0, false, new ArrayList<>());
        }

        // 1. 三角面体素化到体素网格
        boolean[] grid = buildVoxelGrid(buildingMesh, bbox);
        if (grid == null) {
            return detectPathCollisionsWithBBox(pathPoints, buildingMesh);
        }

        int nx = GRID_RES;
        int ny = GRID_RES;
        int nz = GRID_RES;
        Vector3 bboxMin = bbox.min;
        Vector3 bboxMax = bbox.max;
        Vector3 bboxCenter = new Vector3();
        bbox.getCenter(bboxCenter);
        double bboxSize = Math.max(1, bbox.getSize(new Vector3()).length());

        List<CollisionPoint> collisions = new ArrayList<>();

        // 2. 点碰撞：路径点所在体素是否被占用
        for (int i = 0; i < pathPoints.size(); i++) {
            WaypointData point = pathPoints.get(i);
            Vector3 position = new Vector3(point.getX(), point.getY(), point.getZ());

            if (pointInOccupiedVoxel(position, grid, bboxMin, bboxMax, nx, ny, nz)) {
                double severity = 1 - Math.min(1, position.distanceTo(bboxCenter) / bboxSize);
                collisions.add(new CollisionPoint(
                    point.getX(),
                    point.getY(),
                    point.getZ(),
                    severity,
                    i
                ));
            }
        }

        // 3. 线段碰撞 — 3D DDA
        for (int i = 1; i < pathPoints.size(); i++) {
            WaypointData prev = pathPoints.get(i - 1);
            WaypointData curr = pathPoints.get(i);

            Vector3 start = new Vector3(prev.getX(), prev.getY(), prev.getZ());
            Vector3 end = new Vector3(curr.getX(), curr.getY(), curr.getZ());

            if (segmentCollidesVoxelGrid(start, end, grid, bboxMin, bboxMax, nx, ny, nz)) {
                Vector3 midpoint = new Vector3();
                midpoint.add(start).add(end).multiply(0.5);

                double severity = 1 - Math.min(1, midpoint.distanceTo(bboxCenter) / bboxSize);
                collisions.add(new CollisionPoint(
                    midpoint.x,
                    midpoint.y,
                    midpoint.z,
                    severity,
                    i
                ));
            }
        }

        return new CollisionResult(collisions.size(), collisions.size() > 0, collisions);
    }

    /**
     * 三角面体素化：遍历三角面，用每个三角面的 AABB 映射到体素网格并标记占用
     */
    private boolean[] buildVoxelGrid(MeshData mesh, Box3 bbox) {
        List<Double> vertices = mesh.getVertices();
        List<Integer> indices = mesh.getIndices();

        if (vertices == null || vertices.size() < 9) {
            return null;
        }

        int nx = GRID_RES;
        int ny = GRID_RES;
        int nz = GRID_RES;
        boolean[] grid = new boolean[nx * ny * nz];

        Vector3 bboxMin = bbox.min;
        Vector3 bboxMax = bbox.max;
        double dx = bboxMax.x - bboxMin.x;
        double dy = bboxMax.y - bboxMin.y;
        double dz = bboxMax.z - bboxMin.z;
        if (dx < 1e-9) dx = 1;
        if (dy < 1e-9) dy = 1;
        if (dz < 1e-9) dz = 1;

        int triCount;
        if (indices != null && indices.size() >= 3) {
            triCount = indices.size() / 3;
        } else {
            triCount = vertices.size() / 9;
        }

        for (int t = 0; t < triCount; t++) {
            double v0x, v0y, v0z, v1x, v1y, v1z, v2x, v2y, v2z;

            if (indices != null && indices.size() >= 3) {
                int i0 = indices.get(t * 3);
                int i1 = indices.get(t * 3 + 1);
                int i2 = indices.get(t * 3 + 2);
                if (i0 * 3 + 2 >= vertices.size() || i1 * 3 + 2 >= vertices.size() || i2 * 3 + 2 >= vertices.size()) {
                    continue;
                }
                v0x = vertices.get(i0 * 3);
                v0y = vertices.get(i0 * 3 + 1);
                v0z = vertices.get(i0 * 3 + 2);
                v1x = vertices.get(i1 * 3);
                v1y = vertices.get(i1 * 3 + 1);
                v1z = vertices.get(i1 * 3 + 2);
                v2x = vertices.get(i2 * 3);
                v2y = vertices.get(i2 * 3 + 1);
                v2z = vertices.get(i2 * 3 + 2);
            } else {
                // 非索引：顶点顺序 v0,v1,v2, v3,v4,v5, ...
                int base = t * 9;
                v0x = vertices.get(base);
                v0y = vertices.get(base + 1);
                v0z = vertices.get(base + 2);
                v1x = vertices.get(base + 3);
                v1y = vertices.get(base + 4);
                v1z = vertices.get(base + 5);
                v2x = vertices.get(base + 6);
                v2y = vertices.get(base + 7);
                v2z = vertices.get(base + 8);
            }

            // 三角面 AABB
            double triMinX = Math.min(Math.min(v0x, v1x), v2x);
            double triMinY = Math.min(Math.min(v0y, v1y), v2y);
            double triMinZ = Math.min(Math.min(v0z, v1z), v2z);
            double triMaxX = Math.max(Math.max(v0x, v1x), v2x);
            double triMaxY = Math.max(Math.max(v0y, v1y), v2y);
            double triMaxZ = Math.max(Math.max(v0z, v1z), v2z);

            // 映射到网格坐标
            int gx0 = (int) Math.floor((triMinX - bboxMin.x) / dx * (nx - 1e-9));
            int gy0 = (int) Math.floor((triMinY - bboxMin.y) / dy * (ny - 1e-9));
            int gz0 = (int) Math.floor((triMinZ - bboxMin.z) / dz * (nz - 1e-9));
            int gx1 = (int) Math.floor((triMaxX - bboxMin.x) / dx * (nx - 1e-9));
            int gy1 = (int) Math.floor((triMaxY - bboxMin.y) / dy * (ny - 1e-9));
            int gz1 = (int) Math.floor((triMaxZ - bboxMin.z) / dz * (nz - 1e-9));

            gx0 = Math.max(0, Math.min(nx - 1, gx0));
            gy0 = Math.max(0, Math.min(ny - 1, gy0));
            gz0 = Math.max(0, Math.min(nz - 1, gz0));
            gx1 = Math.max(0, Math.min(nx - 1, gx1));
            gy1 = Math.max(0, Math.min(ny - 1, gy1));
            gz1 = Math.max(0, Math.min(nz - 1, gz1));

            for (int gx = gx0; gx <= gx1; gx++) {
                for (int gy = gy0; gy <= gy1; gy++) {
                    for (int gz = gz0; gz <= gz1; gz++) {
                        grid[gx + gy * nx + gz * nx * ny] = true;
                    }
                }
            }
        }

        return grid;
    }

    /**
     * 3D DDA 线段碰撞
     * 体素网格碰撞检测 —— 3D DDA (Amanatides & Woo)
     * 性能 O(穿过的体素数)，不受总体素数影响
     */
    private boolean segmentCollidesVoxelGrid(
            Vector3 start, Vector3 end,
            boolean[] grid,
            Vector3 bboxMin, Vector3 bboxMax,
            int nx, int ny, int nz) {
        double dx = bboxMax.x - bboxMin.x;
        double dy = bboxMax.y - bboxMin.y;
        double dz = bboxMax.z - bboxMin.z;
        if (dx < 1e-9) dx = 1;
        if (dy < 1e-9) dy = 1;
        if (dz < 1e-9) dz = 1;

        double segLen = start.distanceTo(end);
        if (segLen < 1e-9) {
            int gx = (int) Math.floor((start.x - bboxMin.x) / dx * (nx - 1e-9));
            int gy = (int) Math.floor((start.y - bboxMin.y) / dy * (ny - 1e-9));
            int gz = (int) Math.floor((start.z - bboxMin.z) / dz * (nz - 1e-9));
            if (gx >= 0 && gx < nx && gy >= 0 && gy < ny && gz >= 0 && gz < nz) {
                return grid[gx + gy * nx + gz * nx * ny];
            }
            return false;
        }

        double dirX = (end.x - start.x) / segLen;
        double dirY = (end.y - start.y) / segLen;
        double dirZ = (end.z - start.z) / segLen;

        if (Math.abs(dirX) < 1e-12) dirX = 1e-12;
        if (Math.abs(dirY) < 1e-12) dirY = 1e-12;
        if (Math.abs(dirZ) < 1e-12) dirZ = 1e-12;

        int ix = (int) Math.floor((start.x - bboxMin.x) / dx * (nx - 1e-9));
        int iy = (int) Math.floor((start.y - bboxMin.y) / dy * (ny - 1e-9));
        int iz = (int) Math.floor((start.z - bboxMin.z) / dz * (nz - 1e-9));

        ix = Math.max(0, Math.min(nx - 1, ix));
        iy = Math.max(0, Math.min(ny - 1, iy));
        iz = Math.max(0, Math.min(nz - 1, iz));

        int stepX = dirX > 0 ? 1 : -1;
        int stepY = dirY > 0 ? 1 : -1;
        int stepZ = dirZ > 0 ? 1 : -1;

        double voxelSizeX = dx / nx;
        double voxelSizeY = dy / ny;
        double voxelSizeZ = dz / nz;

        double nextX = dirX > 0
                ? bboxMin.x + (ix + 1) * voxelSizeX
                : bboxMin.x + ix * voxelSizeX;
        double nextY = dirY > 0
                ? bboxMin.y + (iy + 1) * voxelSizeY
                : bboxMin.y + iy * voxelSizeY;
        double nextZ = dirZ > 0
                ? bboxMin.z + (iz + 1) * voxelSizeZ
                : bboxMin.z + iz * voxelSizeZ;

        double tMaxX = dirX != 0 ? (nextX - start.x) / dirX : Double.MAX_VALUE;
        double tMaxY = dirY != 0 ? (nextY - start.y) / dirY : Double.MAX_VALUE;
        double tMaxZ = dirZ != 0 ? (nextZ - start.z) / dirZ : Double.MAX_VALUE;

        double tDeltaX = dirX != 0 ? voxelSizeX / Math.abs(dirX) : Double.MAX_VALUE;
        double tDeltaY = dirY != 0 ? voxelSizeY / Math.abs(dirY) : Double.MAX_VALUE;
        double tDeltaZ = dirZ != 0 ? voxelSizeZ / Math.abs(dirZ) : Double.MAX_VALUE;

        double t = 0;
        while (t <= segLen) {
            if (ix >= 0 && ix < nx && iy >= 0 && iy < ny && iz >= 0 && iz < nz) {
                if (grid[ix + iy * nx + iz * nx * ny]) {
                    return true;
                }
            }

            if (tMaxX <= tMaxY && tMaxX <= tMaxZ) {
                t = tMaxX;
                tMaxX += tDeltaX;
                ix += stepX;
            } else if (tMaxY <= tMaxX && tMaxY <= tMaxZ) {
                t = tMaxY;
                tMaxY += tDeltaY;
                iy += stepY;
            } else {
                t = tMaxZ;
                tMaxZ += tDeltaZ;
                iz += stepZ;
            }
        }

        return false;
    }

    private boolean pointInOccupiedVoxel(Vector3 p, boolean[] grid,
            Vector3 bboxMin, Vector3 bboxMax, int nx, int ny, int nz) {
        double dx = bboxMax.x - bboxMin.x;
        double dy = bboxMax.y - bboxMin.y;
        double dz = bboxMax.z - bboxMin.z;
        if (dx < 1e-9) dx = 1;
        if (dy < 1e-9) dy = 1;
        if (dz < 1e-9) dz = 1;

        int gx = (int) Math.floor((p.x - bboxMin.x) / dx * (nx - 1e-9));
        int gy = (int) Math.floor((p.y - bboxMin.y) / dy * (ny - 1e-9));
        int gz = (int) Math.floor((p.z - bboxMin.z) / dz * (nz - 1e-9));

        if (gx < 0 || gx >= nx || gy < 0 || gy >= ny || gz < 0 || gz >= nz) {
            return false;
        }
        return grid[gx + gy * nx + gz * nx * ny];
    }

    /**
     * 回退：无三角面时使用包围盒检测
     */
    private CollisionResult detectPathCollisionsWithBBox(List<WaypointData> pathPoints, MeshData buildingMesh) {
        Box3 bbox = extractBoundingBox(buildingMesh);
        if (bbox == null || bbox.isEmpty()) {
            return new CollisionResult(0, false, new ArrayList<>());
        }

        List<CollisionPoint> collisions = new ArrayList<>();
        Vector3 bboxCenter = new Vector3();
        bbox.getCenter(bboxCenter);
        double bboxSize = bbox.getSize(new Vector3()).length();

        for (int i = 0; i < pathPoints.size(); i++) {
            WaypointData point = pathPoints.get(i);
            Vector3 position = new Vector3(point.getX(), point.getY(), point.getZ());

            if (bbox.containsPoint(position)) {
                double severity = 1 - Math.min(1, position.distanceTo(bboxCenter) / bboxSize);
                collisions.add(new CollisionPoint(
                    point.getX(),
                    point.getY(),
                    point.getZ(),
                    severity,
                    i
                ));
            }
        }

        for (int i = 1; i < pathPoints.size(); i++) {
            WaypointData prev = pathPoints.get(i - 1);
            WaypointData curr = pathPoints.get(i);

            Vector3 start = new Vector3(prev.getX(), prev.getY(), prev.getZ());
            Vector3 end = new Vector3(curr.getX(), curr.getY(), curr.getZ());

            if (lineIntersectsBox(start, end, bbox)) {
                Vector3 midpoint = new Vector3();
                midpoint.add(start).add(end).multiply(0.5);

                double severity = 1 - Math.min(1, midpoint.distanceTo(bboxCenter) / bboxSize);
                collisions.add(new CollisionPoint(
                    midpoint.x,
                    midpoint.y,
                    midpoint.z,
                    severity,
                    i
                ));
            }
        }

        return new CollisionResult(collisions.size(), collisions.size() > 0, collisions);
    }

    private boolean lineIntersectsBox(Vector3 start, Vector3 end, Box3 box) {
        if (box.containsPoint(start) || box.containsPoint(end)) {
            return true;
        }
        Vector3 midpoint = new Vector3();
        midpoint.add(start).add(end).multiply(0.5);
        if (box.containsPoint(midpoint)) {
            return true;
        }
        Vector3 boxCenter = new Vector3();
        box.getCenter(boxCenter);
        double distToCenter = midpoint.distanceTo(boxCenter);
        Vector3 boxSize = new Vector3();
        box.getSize(boxSize);
        double maxSize = Math.max(Math.max(boxSize.x, boxSize.y), boxSize.z);
        return distToCenter < maxSize;
    }

    private Box3 extractBoundingBox(MeshData mesh) {
        if (mesh == null || mesh.getVertices() == null || mesh.getVertices().isEmpty()) {
            return null;
        }
        Box3 bbox = new Box3();
        List<Double> vertices = mesh.getVertices();
        for (int i = 0; i < vertices.size(); i += 3) {
            Vector3 point = new Vector3(vertices.get(i), vertices.get(i + 1), vertices.get(i + 2));
            bbox.expandByPoint(point);
        }
        return bbox;
    }

    public static class CollisionResult {
        public int collisionCount;
        public boolean hasCollision;
        public List<CollisionPoint> collisions;

        public CollisionResult(int collisionCount, boolean hasCollision, List<CollisionPoint> collisions) {
            this.collisionCount = collisionCount;
            this.hasCollision = hasCollision;
            this.collisions = collisions;
        }
    }
}
