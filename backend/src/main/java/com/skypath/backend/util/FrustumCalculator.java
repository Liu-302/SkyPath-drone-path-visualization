package com.skypath.backend.util;

/**
 * 视锥体计算工具类
 * 对应前端camera-utils.ts的calculateFrustumCorners等方法
 */
public class FrustumCalculator {

    /**
     * 计算视锥体的八个角点
     * 对应Three.js的calculateFrustumCorners
     */
    public static FrustumCorners calculateFrustumCorners(
        Vector3 position,
        Vector3 direction,
        Vector3 up,
        double fovDegrees,
        double aspect,
        double near,
        double far
    ) {
        // 将角度转换为弧度
        double fovRad = Math.toRadians(fovDegrees);

        // 计算近平面和远平面的高度和宽度
        double nearHeight = 2 * Math.tan(fovRad / 2) * near;
        double nearWidth = nearHeight * aspect;

        double farHeight = 2 * Math.tan(fovRad / 2) * far;
        double farWidth = farHeight * aspect;

        // 计算右向量 (right = direction × up)
        Vector3 right = Vector3.crossVectors(direction, up);
        right.normalize();

        // 计算近平面中心
        Vector3 nearCenter = new Vector3(
            position.x + direction.x * near,
            position.y + direction.y * near,
            position.z + direction.z * near
        );

        double nearHalfWidth = nearWidth / 2;
        double nearHalfHeight = nearHeight / 2;

        // 计算近平面四个角点
        Vector3[] nearCorners = new Vector3[4];
        // 左下 (left, bottom)
        nearCorners[0] = new Vector3(
            nearCenter.x - right.x * nearHalfWidth - up.x * nearHalfHeight,
            nearCenter.y - right.y * nearHalfWidth - up.y * nearHalfHeight,
            nearCenter.z - right.z * nearHalfWidth - up.z * nearHalfHeight
        );
        // 右下 (right, bottom)
        nearCorners[1] = new Vector3(
            nearCenter.x + right.x * nearHalfWidth - up.x * nearHalfHeight,
            nearCenter.y + right.y * nearHalfWidth - up.y * nearHalfHeight,
            nearCenter.z + right.z * nearHalfWidth - up.z * nearHalfHeight
        );
        // 右上 (right, top)
        nearCorners[2] = new Vector3(
            nearCenter.x + right.x * nearHalfWidth + up.x * nearHalfHeight,
            nearCenter.y + right.y * nearHalfWidth + up.y * nearHalfHeight,
            nearCenter.z + right.z * nearHalfWidth + up.z * nearHalfHeight
        );
        // 左上 (left, top)
        nearCorners[3] = new Vector3(
            nearCenter.x - right.x * nearHalfWidth + up.x * nearHalfHeight,
            nearCenter.y - right.y * nearHalfWidth + up.y * nearHalfHeight,
            nearCenter.z - right.z * nearHalfWidth + up.z * nearHalfHeight
        );

        // 计算远平面中心
        Vector3 farCenter = new Vector3(
            position.x + direction.x * far,
            position.y + direction.y * far,
            position.z + direction.z * far
        );

        double farHalfWidth = farWidth / 2;
        double farHalfHeight = farHeight / 2;

        // 计算远平面四个角点
        Vector3[] farCorners = new Vector3[4];
        // 左下 (left, bottom)
        farCorners[0] = new Vector3(
            farCenter.x - right.x * farHalfWidth - up.x * farHalfHeight,
            farCenter.y - right.y * farHalfWidth - up.y * farHalfHeight,
            farCenter.z - right.z * farHalfWidth - up.z * farHalfHeight
        );
        // 右下 (right, bottom)
        farCorners[1] = new Vector3(
            farCenter.x + right.x * farHalfWidth - up.x * farHalfHeight,
            farCenter.y + right.y * farHalfWidth - up.y * farHalfHeight,
            farCenter.z + right.z * farHalfWidth - up.z * farHalfHeight
        );
        // 右上 (right, top)
        farCorners[2] = new Vector3(
            farCenter.x + right.x * farHalfWidth + up.x * farHalfHeight,
            farCenter.y + right.y * farHalfWidth + up.y * farHalfHeight,
            farCenter.z + right.z * farHalfWidth + up.z * farHalfHeight
        );
        // 左上 (left, top)
        farCorners[3] = new Vector3(
            farCenter.x - right.x * farHalfWidth + up.x * farHalfHeight,
            farCenter.y - right.y * farHalfWidth + up.y * farHalfHeight,
            farCenter.z - right.z * farHalfWidth + up.z * farHalfHeight
        );

        return new FrustumCorners(nearCorners, farCorners);
    }

    /**
     * 根据normal向量计算相机朝向和上方向
     * 对应前端的calculateCameraOrientationFromNormal
     */
    public static CameraOrientation calculateCameraOrientationFromNormal(Vector3 normal) {
        // normal向量就是相机朝向向量
        Vector3 direction = normal.clone();

        // 计算上方向向量(垂直于normal)
        Vector3 up;

        if (Math.abs(normal.y) > 0.9) {
            // normal接近垂直,使用Z轴作为参考
            up = new Vector3(0, 0, normal.y > 0 ? -1 : 1);
        } else {
            // 使用Y轴作为参考,计算垂直于normal的向量
            Vector3 yAxis = new Vector3(0, 1, 0);
            // 计算叉积得到垂直于normal和yAxis的向量
            Vector3 right = new Vector3(
                normal.y * yAxis.z - normal.z * yAxis.y,
                normal.z * yAxis.x - normal.x * yAxis.z,
                normal.x * yAxis.y - normal.y * yAxis.x
            );

            // 归一化right向量
            double rightLen = right.length();
            if (rightLen > 0.001) {
                up = new Vector3(right.x / rightLen, right.y / rightLen, right.z / rightLen);
            } else {
                up = new Vector3(0, 0, 1);
            }
        }

        return new CameraOrientation(direction, up);
    }

    /**
     * 相机朝向和上方向
     */
    public static class CameraOrientation {
        public Vector3 direction;
        public Vector3 up;

        public CameraOrientation(Vector3 direction, Vector3 up) {
            this.direction = direction;
            this.up = up;
        }
    }
}
