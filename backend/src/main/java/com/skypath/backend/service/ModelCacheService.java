package com.skypath.backend.service;

import com.skypath.backend.dto.MeshData;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.concurrent.ConcurrentHashMap;

/**
 * 模型数据缓存服务
 * 用于缓存建筑模型数据，避免每次KPI计算都传输大量模型数据
 */
@Service
@Slf4j
public class ModelCacheService {

    // 使用ConcurrentHashMap存储缓存的模型数据（按projectId）
    private final ConcurrentHashMap<String, MeshData> modelCache = new ConcurrentHashMap<>();

    /**
     * 缓存模型数据
     * @param projectId 项目ID
     * @param meshData 模型数据
     */
    public void cacheModel(String projectId, MeshData meshData) {
        if (meshData != null && (meshData.getVertices() != null && !meshData.getVertices().isEmpty())) {
            modelCache.put(projectId, meshData);
            log.debug("Model data cached: projectId={}, vertexCount={}", projectId, 
                meshData.getVertices() != null ? meshData.getVertices().size() / 3 : 0);
        }
    }

    /**
     * 获取缓存的模型数据
     * @param projectId 项目ID
     * @return 缓存的模型数据，如果不存在则返回null
     */
    public MeshData getCachedModel(String projectId) {
        MeshData cached = modelCache.get(projectId);
        if (cached != null) {
            log.debug("Using cached model data: projectId={}", projectId);
        }
        return cached;
    }

    /**
     * 清除缓存的模型数据
     * @param projectId 项目ID
     */
    public void clearCache(String projectId) {
        modelCache.remove(projectId);
        log.debug("Model cache cleared: projectId={}", projectId);
    }

    /**
     * 检查是否有缓存的模型数据
     * @param projectId 项目ID
     * @return 是否有缓存
     */
    public boolean hasCachedModel(String projectId) {
        return modelCache.containsKey(projectId);
    }
}
