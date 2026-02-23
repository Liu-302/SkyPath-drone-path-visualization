package com.skypath.backend.repository;

import com.skypath.backend.entity.ModelDataChunk;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * 模型数据分块存储 Repository
 */
@Repository
public interface ModelDataChunkRepository extends MongoRepository<ModelDataChunk, String> {

    List<ModelDataChunk> findByProjectIdOrderByChunkIndexAsc(String projectId);

    void deleteByProjectId(String projectId);

    boolean existsByProjectId(String projectId);
}
