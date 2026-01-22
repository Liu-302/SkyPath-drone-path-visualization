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
 * 对应前端的collision-detector.ts
 */
@Service
@Slf4j
public class CollisionDetectorService {

    /**
     * 检测路径与建筑物的碰撞
     * 对应前端的detectPathCollisions
     */
    public CollisionResult detectPathCollisions(List<WaypointData> pathPoints, MeshData buildingMesh) {
        if (pathPoints == null || pathPoints.isEmpty() || buildingMesh == null || buildingMesh.getVertices() == null) {
            return new CollisionResult(0, false, new ArrayList<>());
        }

        Box3 bbox = extractBoundingBox(buildingMesh);
        if (bbox == null || bbox.isEmpty()) {
            return new CollisionResult(0, false, new ArrayList<>());
        }

        List<CollisionPoint> collisions = new ArrayList<>();
        Vector3 bboxCenter = new Vector3();
        bbox.getCenter(bboxCenter);
        double bboxSize = bbox.getSize(new Vector3()).length();

        // 点碰撞(路径点位于建筑物内部)
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

        // 线段碰撞(路径段穿过建筑物)
        for (int i = 1; i < pathPoints.size(); i++) {
            WaypointData prev = pathPoints.get(i - 1);
            WaypointData curr = pathPoints.get(i);

            Vector3 start = new Vector3(prev.getX(), prev.getY(), prev.getZ());
            Vector3 end = new Vector3(curr.getX(), curr.getY(), curr.getZ());

            if (lineIntersectsBox(start, end, bbox)) {
                // 计算中点
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
     * 检测线段是否与包围盒相交
     */
    private boolean lineIntersectsBox(Vector3 start, Vector3 end, Box3 box) {
        // 快速检测:如果线段端点都在包围盒内,则相交
        if (box.containsPoint(start) || box.containsPoint(end)) {
            return true;
        }

        // 检查线段与包围盒的交点
        Vector3 direction = Vector3.subVectors(end, start);
        direction.normalize();

        // 简化检测:检查中点
        Vector3 midpoint = new Vector3();
        midpoint.add(start).add(end).multiply(0.5);

        if (box.containsPoint(midpoint)) {
            return true;
        }

        // 检查线段是否足够接近包围盒
        Vector3 boxCenter = new Vector3();
        box.getCenter(boxCenter);
        double distToCenter = midpoint.distanceTo(boxCenter);

        // 简化的碰撞检测:如果中点到中心的距离小于包围盒尺寸,认为可能碰撞
        Vector3 boxSize = new Vector3();
        box.getSize(boxSize);
        double maxSize = Math.max(Math.max(boxSize.x, boxSize.y), boxSize.z);

        if (distToCenter < maxSize) {
            return true;
        }

        return false;
    }

    /**
     * 提取包围盒
     */
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

    /**
     * 碰撞结果
     */
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
