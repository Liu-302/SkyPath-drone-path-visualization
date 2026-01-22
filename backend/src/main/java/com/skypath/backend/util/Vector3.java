package com.skypath.backend.util;

/**
 * 3D向量工具类
 * 对应Three.js的Vector3
 */
public class Vector3 {
    public double x;
    public double y;
    public double z;

    public Vector3() {
        this.x = 0;
        this.y = 0;
        this.z = 0;
    }

    public Vector3(double x, double y, double z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    public Vector3(Vector3 other) {
        this.x = other.x;
        this.y = other.y;
        this.z = other.z;
    }

    /**
     * 设置向量值
     */
    public Vector3 set(double x, double y, double z) {
        this.x = x;
        this.y = y;
        this.z = z;
        return this;
    }

    /**
     * 复制向量
     */
    public Vector3 clone() {
        return new Vector3(this.x, this.y, this.z);
    }

    /**
     * 向量加法
     */
    public Vector3 add(Vector3 v) {
        this.x += v.x;
        this.y += v.y;
        this.z += v.z;
        return this;
    }

    public Vector3 add(double x, double y, double z) {
        this.x += x;
        this.y += y;
        this.z += z;
        return this;
    }

    /**
     * 向量加法(返回新向量)
     */
    public static Vector3 addVectors(Vector3 a, Vector3 b) {
        return new Vector3(a.x + b.x, a.y + b.y, a.z + b.z);
    }

    /**
     * 向量减法
     */
    public Vector3 sub(Vector3 v) {
        this.x -= v.x;
        this.y -= v.y;
        this.z -= v.z;
        return this;
    }

    /**
     * 向量减法(返回新向量)
     */
    public static Vector3 subVectors(Vector3 a, Vector3 b) {
        return new Vector3(a.x - b.x, a.y - b.y, a.z - b.z);
    }

    /**
     * 向量乘法(标量)
     */
    public Vector3 multiply(double s) {
        this.x *= s;
        this.y *= s;
        this.z *= s;
        return this;
    }

    /**
     * 向量点积
     */
    public double dot(Vector3 v) {
        return this.x * v.x + this.y * v.y + this.z * v.z;
    }

    /**
     * 向量叉积
     */
    public Vector3 cross(Vector3 v) {
        double ax = this.x, ay = this.y, az = this.z;
        double bx = v.x, by = v.y, bz = v.z;

        this.x = ay * bz - az * by;
        this.y = az * bx - ax * bz;
        this.z = ax * by - ay * bx;

        return this;
    }

    /**
     * 向量叉积(返回新向量)
     */
    public static Vector3 crossVectors(Vector3 a, Vector3 b) {
        return new Vector3(
            a.y * b.z - a.z * b.y,
            a.z * b.x - a.x * b.z,
            a.x * b.y - a.y * b.x
        );
    }

    /**
     * 向量长度
     */
    public double length() {
        return Math.sqrt(x * x + y * y + z * z);
    }

    /**
     * 向量长度平方
     */
    public double lengthSq() {
        return x * x + y * y + z * z;
    }

    /**
     * 归一化
     */
    public Vector3 normalize() {
        double len = length();
        if (len > 0) {
            this.x /= len;
            this.y /= len;
            this.z /= len;
        }
        return this;
    }

    /**
     * 距离
     */
    public double distanceTo(Vector3 v) {
        double dx = this.x - v.x;
        double dy = this.y - v.y;
        double dz = this.z - v.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    /**
     * 距离平方
     */
    public double distanceToSquared(Vector3 v) {
        double dx = this.x - v.x;
        double dy = this.y - v.y;
        double dz = this.z - v.z;
        return dx * dx + dy * dy + dz * dz;
    }

    /**
     * 应用标量乘法(返回新向量)
     */
    public Vector3 cloneAndMultiply(double s) {
        return new Vector3(this.x * s, this.y * s, this.z * s);
    }

    @Override
    public String toString() {
        return String.format("(%.2f, %.2f, %.2f)", x, y, z);
    }
}
