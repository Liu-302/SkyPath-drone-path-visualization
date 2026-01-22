package com.skypath.backend.util;

/**
 * 3D包围盒工具类
 * 对应Three.js的Box3
 */
public class Box3 {
    public Vector3 min;
    public Vector3 max;

    public Box3() {
        this.min = new Vector3(Double.MAX_VALUE, Double.MAX_VALUE, Double.MAX_VALUE);
        this.max = new Vector3(Double.MIN_VALUE, Double.MIN_VALUE, Double.MIN_VALUE);
    }

    public Box3(Vector3 min, Vector3 max) {
        this.min = min.clone();
        this.max = max.clone();
    }

    /**
     * 扩展包围盒以包含点
     */
    public Box3 expandByPoint(Vector3 point) {
        this.min.x = Math.min(this.min.x, point.x);
        this.min.y = Math.min(this.min.y, point.y);
        this.min.z = Math.min(this.min.z, point.z);

        this.max.x = Math.max(this.max.x, point.x);
        this.max.y = Math.max(this.max.y, point.y);
        this.max.z = Math.max(this.max.z, point.z);

        return this;
    }

    /**
     * 扩展包围盒以包含标量值
     */
    public Box3 expandByScalar(double scalar) {
        this.min.x -= scalar;
        this.min.y -= scalar;
        this.min.z -= scalar;

        this.max.x += scalar;
        this.max.y += scalar;
        this.max.z += scalar;

        return this;
    }

    /**
     * 获取中心点
     */
    public Vector3 getCenter(Vector3 target) {
        return target.set(
            (this.min.x + this.max.x) * 0.5,
            (this.min.y + this.max.y) * 0.5,
            (this.min.z + this.max.z) * 0.5
        );
    }

    /**
     * 获取尺寸
     */
    public Vector3 getSize(Vector3 target) {
        return target.set(
            this.max.x - this.min.x,
            this.max.y - this.min.y,
            this.max.z - this.min.z
        );
    }

    /**
     * 检查是否为空
     */
    public boolean isEmpty() {
        return (this.max.x < this.min.x) ||
               (this.max.y < this.min.y) ||
               (this.max.z < this.min.z);
    }

    /**
     * 检查是否包含点
     */
    public boolean containsPoint(Vector3 point) {
        return point.x >= this.min.x && point.x <= this.max.x &&
               point.y >= this.min.y && point.y <= this.max.y &&
               point.z >= this.min.z && point.z <= this.max.z;
    }

    /**
     * 检查是否与另一个包围盒相交
     */
    public boolean intersectsBox(Box3 box) {
        if (box.max.x < this.min.x || box.min.x > this.max.x) return false;
        if (box.max.y < this.min.y || box.min.y > this.max.y) return false;
        if (box.max.z < this.min.z || box.min.z > this.max.z) return false;
        return true;
    }

    /**
     * 克隆
     */
    public Box3 clone() {
        return new Box3(this.min, this.max);
    }

    /**
     * 与另一个包围盒的交集
     */
    public Box3 intersect(Box3 box) {
        this.min.x = Math.max(this.min.x, box.min.x);
        this.min.y = Math.max(this.min.y, box.min.y);
        this.min.z = Math.max(this.min.z, box.min.z);

        this.max.x = Math.min(this.max.x, box.max.x);
        this.max.y = Math.min(this.max.y, box.max.y);
        this.max.z = Math.min(this.max.z, box.max.z);

        return this;
    }

    /**
     * 克隆并创建交集
     */
    public Box3 cloneAndIntersect(Box3 box) {
        return new Box3(
            new Vector3(Math.max(this.min.x, box.min.x), Math.max(this.min.y, box.min.y), Math.max(this.min.z, box.min.z)),
            new Vector3(Math.min(this.max.x, box.max.x), Math.min(this.max.y, box.max.y), Math.min(this.max.z, box.max.z))
        );
    }
}
