package com.skypath.backend.service;

import com.skypath.backend.dto.KPIMetrics;
import com.skypath.backend.dto.WaypointData;
import com.skypath.backend.dto.MeshData;
import com.skypath.backend.entity.Project;
import com.skypath.backend.entity.Waypoint;
import com.skypath.backend.entity.ModelData;
import com.skypath.backend.entity.ModelDataChunk;
import com.skypath.backend.repository.ProjectRepository;
import com.skypath.backend.repository.WaypointRepository;
import com.skypath.backend.repository.ModelDataRepository;
import com.skypath.backend.repository.ModelDataChunkRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Service for Project operations
 */
@Service
@RequiredArgsConstructor
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final WaypointRepository waypointRepository;
    private final ModelDataRepository modelDataRepository;
    private final ModelDataChunkRepository modelDataChunkRepository;
    private final KPICalculatorService kpiCalculatorService;
    private final ModelCacheService modelCacheService;
    private final CoverageCalculatorService coverageCalculatorService;

    public List<Project> getAllProjects(String userId) {
        return projectRepository.findByUserIdOrderByUpdatedAtDesc(userId);
    }

    public Optional<Project> getProjectById(String id) {
        return projectRepository.findById(id);
    }

    public Project createProject(Project project) {
        project.setCreatedAt(LocalDateTime.now());
        project.setUpdatedAt(LocalDateTime.now());
        return projectRepository.save(project);
    }

    public Project updateProject(String id, Project projectDetails) {
        return projectRepository.findById(id).map(project -> {
            project.setName(projectDetails.getName());
            project.setDescription(projectDetails.getDescription());
            project.setUpdatedAt(LocalDateTime.now());
            return projectRepository.save(project);
        }).orElse(null);
    }

    @Transactional
    public void deleteProject(String id) {
        // Delete associated waypoints and model data first
        waypointRepository.deleteByProjectId(id);
        modelDataRepository.deleteByProjectId(id);
        modelDataChunkRepository.deleteByProjectId(id);
        modelCacheService.clearCache(id); // 清除内存缓存
        projectRepository.deleteById(id);
    }

    /**
     * Get waypoints for a project
     */
    public List<Waypoint> getWaypoints(String projectId) {
        return waypointRepository.findByProjectIdOrderBySequenceOrder(projectId);
    }

    /**
     * Save waypoints for a project
     */
    public List<Waypoint> saveWaypoints(String projectId, List<WaypointData> waypointDataList) {
        // Delete existing waypoints
        waypointRepository.deleteByProjectId(projectId);

        // Save new waypoints
        int order = 0;
        for (WaypointData data : waypointDataList) {
            Waypoint waypoint = new Waypoint();
            waypoint.setProjectId(projectId);
            waypoint.setName("WP" + String.format("%02d", order + 1));
            waypoint.setX(data.getX());
            waypoint.setY(data.getY());
            waypoint.setZ(data.getZ());
            waypoint.setNormalX(data.getNormalX());
            waypoint.setNormalY(data.getNormalY());
            waypoint.setNormalZ(data.getNormalZ());
            waypoint.setSequenceOrder(order++);
            waypointRepository.save(waypoint);
        }

        return waypointRepository.findByProjectIdOrderBySequenceOrder(projectId);
    }

    /** 单块顶点数量上限（9 万 double = 3 万顶点 ≈ 720KB），避免超过 MongoDB 16MB 限制 */
    private static final int VERTEX_CHUNK_SIZE = 90_000;
    /** 单块索引数量上限（12 万 int = 4 万三角形 ≈ 480KB） */
    private static final int INDEX_CHUNK_SIZE = 120_000;

    /**
     * Save model data for a project
     * 分块存储，规避 MongoDB 单文档 16MB 限制
     */
    public ModelData saveModelData(String projectId, MeshData meshData, String originalFileName) {
        modelDataRepository.deleteByProjectId(projectId);
        modelDataChunkRepository.deleteByProjectId(projectId);

        List<Double> vertices = meshData.getVertices();
        List<Integer> indices = meshData.getIndices();
        if (vertices == null || vertices.isEmpty()) {
            throw new IllegalArgumentException("vertices cannot be empty");
        }

        List<ModelDataChunk> chunks = new ArrayList<>();
        int chunkIndex = 0;

        // 顶点分块（每块 VERTEX_CHUNK_SIZE 个 double，保证为 3 的倍数以保持顶点完整）
        for (int i = 0; i < vertices.size(); i += VERTEX_CHUNK_SIZE) {
            int end = Math.min(i + VERTEX_CHUNK_SIZE, vertices.size());
            end = end - (end % 3);
            if (i >= end) continue;
            ModelDataChunk chunk = new ModelDataChunk();
            chunk.setProjectId(projectId);
            chunk.setChunkIndex(chunkIndex++);
            chunk.setOriginalFileName(originalFileName);
            chunk.setVertexChunk(new ArrayList<>(vertices.subList(i, end)));
            chunk.setIndexChunk(null);
            chunks.add(chunk);
        }

        // 索引分块
        if (indices != null && !indices.isEmpty()) {
            for (int i = 0; i < indices.size(); i += INDEX_CHUNK_SIZE) {
                int end = Math.min(i + INDEX_CHUNK_SIZE, indices.size());
                ModelDataChunk chunk = new ModelDataChunk();
                chunk.setProjectId(projectId);
                chunk.setChunkIndex(chunkIndex++);
                chunk.setOriginalFileName(originalFileName);
                chunk.setVertexChunk(null);
                chunk.setIndexChunk(new ArrayList<>(indices.subList(i, end)));
                chunks.add(chunk);
            }
        }

        int totalChunks = chunks.size();
        for (ModelDataChunk c : chunks) {
            c.setTotalChunks(totalChunks);
        }
        modelDataChunkRepository.saveAll(chunks);

        modelCacheService.cacheModel(projectId, meshData);

        ModelData meta = new ModelData();
        meta.setProjectId(projectId);
        meta.setOriginalFileName(originalFileName);
        meta.setVertexCount(vertices.size() / 3);
        meta.setFaceCount(indices != null ? indices.size() / 3 : 0);
        return meta;
    }

    /**
     * Get model data for a project
     * 从分块合并加载
     */
    public Optional<MeshData> getModelData(String projectId) {
        List<ModelDataChunk> chunks = modelDataChunkRepository.findByProjectIdOrderByChunkIndexAsc(projectId);
        if (chunks.isEmpty()) {
            return modelDataRepository.findByProjectId(projectId)
                    .map(m -> {
                        MeshData md = new MeshData();
                        md.setVertices(m.getVertices());
                        md.setIndices(m.getIndices());
                        return md;
                    });
        }

        List<Double> vertices = new ArrayList<>();
        List<Integer> indices = new ArrayList<>();
        for (ModelDataChunk c : chunks) {
            if (c.getVertexChunk() != null) vertices.addAll(c.getVertexChunk());
            if (c.getIndexChunk() != null) indices.addAll(c.getIndexChunk());
        }
        MeshData meshData = new MeshData();
        meshData.setVertices(vertices);
        meshData.setIndices(indices.isEmpty() ? null : indices);
        return Optional.of(meshData);
    }

    /**
     * Check if project has model data
     */
    public boolean hasModelData(String projectId) {
        return modelDataChunkRepository.existsByProjectId(projectId)
                || modelDataRepository.existsByProjectId(projectId);
    }

    /**
     * Calculate KPI metrics for a project
     * 接收建筑模型数据,实现完整的KPI计算
     * 如果传入buildingMesh，会先缓存；如果没有传入，会使用缓存的模型或从数据库加载
     */
    public KPIMetrics calculateKPIs(String projectId, List<WaypointData> pathPoints, MeshData buildingMesh) {
        // 如果没有传入路径点,从数据库获取
        if (pathPoints == null || pathPoints.isEmpty()) {
            List<Waypoint> waypoints = waypointRepository.findByProjectIdOrderBySequenceOrder(projectId);

            if (waypoints == null || waypoints.isEmpty()) {
                throw new IllegalArgumentException("No waypoints found for project: " + projectId);
            }

            // Convert waypoints to waypoint data
            pathPoints = waypoints.stream()
                    .map(wp -> new WaypointData(wp.getX(), wp.getY(), wp.getZ(),
                            wp.getNormalX(), wp.getNormalY(), wp.getNormalZ()))
                    .toList();
        }

        // 模型数据获取逻辑（优先级：传入数据 > 内存缓存 > 数据库）
        MeshData meshToUse = buildingMesh;
        
        if (buildingMesh != null && (buildingMesh.getVertices() != null && !buildingMesh.getVertices().isEmpty())) {
            // 如果传入了模型数据，缓存到内存（但不保存到数据库，需要显式调用saveModelData）
            modelCacheService.cacheModel(projectId, buildingMesh);
            meshToUse = buildingMesh;
        } else {
            // 如果没有传入模型数据，尝试使用内存缓存
            MeshData cachedMesh = modelCacheService.getCachedModel(projectId);
            if (cachedMesh != null) {
                meshToUse = cachedMesh;
            } else {
                // 如果内存缓存也没有，尝试从数据库加载
                Optional<MeshData> dbMesh = getModelData(projectId);
                if (dbMesh.isPresent()) {
                    meshToUse = dbMesh.get();
                    // 加载到内存缓存，下次可以直接使用
                    modelCacheService.cacheModel(projectId, meshToUse);
                }
            }
        }

        // 调用KPI计算服务
        return kpiCalculatorService.calculateAllKPIs(pathPoints, meshToUse);
    }

    /**
     * 批量计算每个航点数的累计覆盖率，与 KPI Coverage Rate 完全一致
     */
    public Map<Integer, Double> calculateCoverageByWaypointCount(
            String projectId, List<WaypointData> pathPoints, MeshData buildingMesh) {
        if (pathPoints == null || pathPoints.isEmpty()) return Map.of();
        MeshData meshToUse = buildingMesh;
        if (buildingMesh == null || buildingMesh.getVertices() == null || buildingMesh.getVertices().isEmpty()) {
            MeshData cached = modelCacheService.getCachedModel(projectId);
            if (cached != null) meshToUse = cached;
            else {
                Optional<MeshData> db = getModelData(projectId);
                if (db.isPresent()) {
                    meshToUse = db.get();
                    modelCacheService.cacheModel(projectId, meshToUse);
                }
            }
        } else {
            modelCacheService.cacheModel(projectId, buildingMesh);
        }
        if (meshToUse == null) return Map.of();
        return coverageCalculatorService.calculateCoverageByWaypointCount(pathPoints, meshToUse);
    }

    /**
     * Calculate KPI metrics for a project (without building mesh)
     * 保留旧方法用于兼容
     */
    public KPIMetrics calculateKPIs(String projectId) {
        return calculateKPIs(projectId, null, null);
    }

    /**
     * Calculate single-viewpoint metrics (coverage/overlap-with-previous) for panel details.
     * buildingMesh 可以为 null，将按优先级：传入 > 内存缓存 > 数据库 获取。
     */
    public CoverageCalculatorService.ViewpointMetrics calculateViewpointMetrics(
            String projectId,
            List<WaypointData> pathPoints,
            Integer index,
            MeshData buildingMesh
    ) {
        if (index == null) {
            throw new IllegalArgumentException("viewpoint index is required");
        }

        // 模型数据获取逻辑（优先级：传入数据 > 内存缓存 > 数据库）
        MeshData meshToUse = buildingMesh;

        if (buildingMesh != null && (buildingMesh.getVertices() != null && !buildingMesh.getVertices().isEmpty())) {
            modelCacheService.cacheModel(projectId, buildingMesh);
            meshToUse = buildingMesh;
        } else {
            MeshData cachedMesh = modelCacheService.getCachedModel(projectId);
            if (cachedMesh != null) {
                meshToUse = cachedMesh;
            } else {
                Optional<MeshData> dbMesh = getModelData(projectId);
                if (dbMesh.isPresent()) {
                    meshToUse = dbMesh.get();
                    modelCacheService.cacheModel(projectId, meshToUse);
                }
            }
        }

        return coverageCalculatorService.calculateViewpointMetrics(pathPoints, meshToUse, index);
    }

    /**
     * 播放模式高亮：计算已飞过视点与当前视点的可见面索引
     */
    public CoverageCalculatorService.PlaybackHighlightResult computePlaybackHighlight(
            String projectId,
            List<WaypointData> pastViewpoints,
            WaypointData currentViewpoint,
            MeshData buildingMesh
    ) {
        MeshData meshToUse = buildingMesh;
        if (buildingMesh != null && buildingMesh.getVertices() != null && !buildingMesh.getVertices().isEmpty()) {
            modelCacheService.cacheModel(projectId, buildingMesh);
            meshToUse = buildingMesh;
        } else {
            MeshData cached = modelCacheService.getCachedModel(projectId);
            if (cached != null) meshToUse = cached;
            else {
                Optional<MeshData> dbMesh = getModelData(projectId);
                if (dbMesh.isPresent()) {
                    meshToUse = dbMesh.get();
                    modelCacheService.cacheModel(projectId, meshToUse);
                }
            }
        }
        return coverageCalculatorService.computePlaybackHighlight(pastViewpoints, currentViewpoint, meshToUse);
    }
}
