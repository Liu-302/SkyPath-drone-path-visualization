package com.skypath.backend.service;

import com.skypath.backend.dto.KPIMetrics;
import com.skypath.backend.dto.WaypointData;
import com.skypath.backend.dto.MeshData;
import com.skypath.backend.entity.Project;
import com.skypath.backend.entity.Waypoint;
import com.skypath.backend.entity.ModelData;
import com.skypath.backend.repository.ProjectRepository;
import com.skypath.backend.repository.WaypointRepository;
import com.skypath.backend.repository.ModelDataRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
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
    private final KPICalculatorService kpiCalculatorService;
    private final ModelCacheService modelCacheService;

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
        modelCacheService.clearCache(id); // 清除内存缓存
        projectRepository.deleteById(id);
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

    /**
     * Save model data for a project
     * 保存建筑模型数据到数据库
     */
    public ModelData saveModelData(String projectId, MeshData meshData, String originalFileName) {
        // 删除现有的模型数据
        modelDataRepository.deleteByProjectId(projectId);
        
        // 创建新的模型数据实体
        ModelData modelData = new ModelData(projectId, meshData.getVertices(), 
                meshData.getIndices(), originalFileName);
        
        // 保存到数据库
        ModelData saved = modelDataRepository.save(modelData);
        
        // 同时更新内存缓存
        modelCacheService.cacheModel(projectId, meshData);
        
        return saved;
    }

    /**
     * Get model data for a project
     * 从数据库加载建筑模型数据
     */
    public Optional<MeshData> getModelData(String projectId) {
        return modelDataRepository.findByProjectId(projectId)
                .map(modelData -> {
                    MeshData meshData = new MeshData();
                    meshData.setVertices(modelData.getVertices());
                    meshData.setIndices(modelData.getIndices());
                    return meshData;
                });
    }

    /**
     * Check if project has model data
     * 检查项目是否有模型数据
     */
    public boolean hasModelData(String projectId) {
        return modelDataRepository.existsByProjectId(projectId);
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
     * Calculate KPI metrics for a project (without building mesh)
     * 保留旧方法用于兼容
     */
    public KPIMetrics calculateKPIs(String projectId) {
        return calculateKPIs(projectId, null, null);
    }
}
