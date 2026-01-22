package com.skypath.backend.dto;

import lombok.Data;

import java.util.List;

/**
 * 网格数据DTO
 * 用于从前端传递建筑模型数据到后端
 */
@Data
public class MeshData {
    /** 顶点数据(扁平化数组: x1, y1, z1, x2, y2, z2, ...) */
    private List<Double> vertices;

    /** 索引数据(可选,用于索引三角形网格) */
    private List<Integer> indices;
}
