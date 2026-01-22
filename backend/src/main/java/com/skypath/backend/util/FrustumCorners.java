package com.skypath.backend.util;

/**
 * 视锥体角点数据类
 * 对应前端FrustumCorners接口
 */
public class FrustumCorners {
    public Vector3[] near;
    public Vector3[] far;

    public FrustumCorners() {
        this.near = new Vector3[4];
        this.far = new Vector3[4];
        for (int i = 0; i < 4; i++) {
            near[i] = new Vector3();
            far[i] = new Vector3();
        }
    }

    public FrustumCorners(Vector3[] near, Vector3[] far) {
        this.near = near;
        this.far = far;
    }

    /**
     * 获取所有角点
     */
    public Vector3[] getAllCorners() {
        Vector3[] all = new Vector3[8];
        System.arraycopy(near, 0, all, 0, 4);
        System.arraycopy(far, 0, all, 4, 4);
        return all;
    }

    /**
     * 计算包围盒
     */
    public Box3 getBoundingBox() {
        Box3 box = new Box3();
        for (Vector3 corner : near) {
            box.expandByPoint(corner);
        }
        for (Vector3 corner : far) {
            box.expandByPoint(corner);
        }
        return box;
    }
}
