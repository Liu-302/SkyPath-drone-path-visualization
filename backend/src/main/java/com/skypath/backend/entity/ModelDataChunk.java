package com.skypath.backend.entity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.List;

/**
 * 模型数据分块存储，规避 MongoDB 单文档 16MB 限制
 * 每个 chunk 控制在 ~2MB 以内
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "model_data_chunks")
public class ModelDataChunk {

    @Id
    private String id;

    @Indexed
    private String projectId;

    /** 块序号，从 0 开始 */
    private int chunkIndex;

    /** 总块数 */
    private int totalChunks;

    /** 原始文件名 */
    private String originalFileName;

    /** 顶点数据分块 (x1,y1,z1, x2,y2,z2, ...)，每块约 10 万顶点 = 30 万 double ≈ 2.4MB */
    private List<Double> vertexChunk;

    /** 索引数据分块，每块约 15 万 int ≈ 600KB */
    private List<Integer> indexChunk;
}
