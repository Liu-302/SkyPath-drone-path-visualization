package com.skypath.backend.entity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

/**
 * ModelData entity for MongoDB
 * Stores 3D building model data (OBJ file data) for a project
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "model_data")
public class ModelData {

    @Id
    private String id;

    /** 项目ID，关联到Project */
    private String projectId;

    /** 顶点数据(扁平化数组: x1, y1, z1, x2, y2, z2, ...) */
    private List<Double> vertices;

    /** 索引数据(可选,用于索引三角形网格) */
    private List<Integer> indices;

    /** 原始文件名 */
    private String originalFileName;

    /** 顶点数量 */
    private Integer vertexCount;

    /** 面片数量 */
    private Integer faceCount;

    /** 创建时间 */
    private LocalDateTime createdAt;

    /** 更新时间 */
    private LocalDateTime updatedAt;

    public ModelData(String projectId, List<Double> vertices, List<Integer> indices, String originalFileName) {
        this.projectId = projectId;
        this.vertices = vertices;
        this.indices = indices;
        this.originalFileName = originalFileName;
        this.vertexCount = vertices != null ? vertices.size() / 3 : 0;
        this.faceCount = indices != null ? indices.size() / 3 : 0;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }
}
