package com.skypath.backend.repository;

import com.skypath.backend.entity.ModelData;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Repository for ModelData entity
 */
@Repository
public interface ModelDataRepository extends MongoRepository<ModelData, String> {

    /**
     * 根据项目ID查找模型数据
     * @param projectId 项目ID
     * @return 模型数据，如果不存在则返回空
     */
    Optional<ModelData> findByProjectId(String projectId);

    /**
     * 检查项目是否有模型数据
     * @param projectId 项目ID
     * @return 是否存在
     */
    boolean existsByProjectId(String projectId);

    /**
     * 根据项目ID删除模型数据
     * @param projectId 项目ID
     */
    void deleteByProjectId(String projectId);
}
