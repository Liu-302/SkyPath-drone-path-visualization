package com.skypath.backend.controller;

import com.skypath.backend.dto.KPIMetrics;
import com.skypath.backend.dto.WaypointData;
import com.skypath.backend.dto.MeshData;
import com.skypath.backend.entity.Project;
import com.skypath.backend.entity.Waypoint;
import com.skypath.backend.entity.ModelData;
import com.skypath.backend.service.ProjectService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST Controller for Project operations
 */
@RestController
@RequestMapping("/api/projects")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*")
public class ProjectController {

    private final ProjectService projectService;

    @GetMapping
    public ResponseEntity<List<Project>> getAllProjects(@RequestParam String userId) {
        List<Project> projects = projectService.getAllProjects(userId);
        return ResponseEntity.ok(projects);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Project> getProjectById(@PathVariable String id) {
        return projectService.getProjectById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<Project> createProject(@RequestBody Project project) {
        Project createdProject = projectService.createProject(project);
        return ResponseEntity.status(HttpStatus.CREATED).body(createdProject);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Project> updateProject(
            @PathVariable String id,
            @RequestBody Project projectDetails) {
        Project updatedProject = projectService.updateProject(id, projectDetails);
        if (updatedProject != null) {
            return ResponseEntity.ok(updatedProject);
        }
        return ResponseEntity.notFound().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteProject(@PathVariable String id) {
        projectService.deleteProject(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Save waypoints for a project
     */
    @PostMapping("/{id}/waypoints")
    public ResponseEntity<List<Waypoint>> saveWaypoints(
            @PathVariable String id,
            @RequestBody List<WaypointData> waypoints) {
        try {
            List<Waypoint> savedWaypoints = projectService.saveWaypoints(id, waypoints);
            return ResponseEntity.ok(savedWaypoints);
        } catch (Exception e) {
            log.error("保存航点失败: projectId={}, error={}", id, e.getMessage(), e);
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Save model data for a project
     * 保存建筑模型数据到数据库
     */
    @PostMapping("/{id}/model")
    public ResponseEntity<ModelData> saveModelData(
            @PathVariable String id,
            @RequestBody ModelDataRequest request) {
        try {
            if (request == null || request.getMeshData() == null) {
                log.error("模型数据保存请求为空: projectId={}", id);
                return ResponseEntity.badRequest().build();
            }

            MeshData meshData = request.getMeshData();
            if (meshData.getVertices() == null || meshData.getVertices().isEmpty()) {
                log.error("模型数据顶点为空: projectId={}", id);
                return ResponseEntity.badRequest().build();
            }

            String fileName = request.getFileName() != null ? request.getFileName() : "unknown.obj";
            ModelData saved = projectService.saveModelData(id, meshData, fileName);
            log.info("模型数据已保存: projectId={}, fileName={}, vertexCount={}", 
                    id, fileName, saved.getVertexCount());
            return ResponseEntity.ok(saved);
        } catch (Exception e) {
            log.error("保存模型数据失败: projectId={}, error={}", id, e.getMessage(), e);
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Get model data for a project
     * 获取项目的建筑模型数据
     */
    @GetMapping("/{id}/model")
    public ResponseEntity<MeshData> getModelData(@PathVariable String id) {
        return projectService.getModelData(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Check if project has model data
     * 检查项目是否有模型数据
     */
    @GetMapping("/{id}/model/exists")
    public ResponseEntity<Boolean> hasModelData(@PathVariable String id) {
        boolean exists = projectService.hasModelData(id);
        return ResponseEntity.ok(exists);
    }

    /**
     * Calculate KPI metrics for a project
     * 接收路径点和建筑模型数据
     */
    @PostMapping("/{id}/kpi")
    public ResponseEntity<KPIMetrics> calculateKPIs(
            @PathVariable String id,
            @RequestBody KPICalculationRequest request) {
        try {
            // 验证请求数据
            if (request == null) {
                log.error("KPI计算请求为空: projectId={}", id);
                return ResponseEntity.badRequest().build();
            }
            
            List<WaypointData> pathPoints = request.getPathPoints();
            if (pathPoints == null || pathPoints.isEmpty()) {
                log.error("KPI计算路径点为空: projectId={}", id);
                return ResponseEntity.badRequest().build();
            }
            
            if (pathPoints.size() < 2) {
                log.error("KPI计算路径点数量不足: projectId={}, count={}", id, pathPoints.size());
                return ResponseEntity.badRequest().build();
            }
            
            // 验证路径点数据格式
            for (int i = 0; i < pathPoints.size(); i++) {
                WaypointData point = pathPoints.get(i);
                if (point == null || point.getX() == null || point.getY() == null || point.getZ() == null) {
                    log.error("KPI计算路径点数据无效: projectId={}, index={}", id, i);
                    return ResponseEntity.badRequest().build();
                }
            }
            
            // buildingMesh 可以为 null，如果为 null 则使用缓存的模型
            // 如果提供了 buildingMesh，会先缓存，然后使用
            MeshData buildingMesh = request.getBuildingMesh();
            
            // 如果 buildingMesh 为空或没有顶点数据，尝试使用缓存的模型
            // 这样后续计算就不需要每次都传输模型数据了
            KPIMetrics metrics = projectService.calculateKPIs(id, pathPoints, buildingMesh);
            return ResponseEntity.ok(metrics);
        } catch (IllegalArgumentException e) {
            log.error("KPI计算参数错误: projectId={}, error={}", id, e.getMessage(), e);
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            log.error("KPI计算失败: projectId={}, error={}", id, e.getMessage(), e);
            // 将未知异常转换为参数异常，避免500错误
            // 返回400而不是500，因为这是客户端请求的问题
            return ResponseEntity.badRequest().build();
        }
    }


    /**
     * KPI计算请求体
     */
    public static class KPICalculationRequest {
        private List<WaypointData> pathPoints;
        private MeshData buildingMesh;

        public List<WaypointData> getPathPoints() {
            return pathPoints;
        }

        public void setPathPoints(List<WaypointData> pathPoints) {
            this.pathPoints = pathPoints;
        }

        public MeshData getBuildingMesh() {
            return buildingMesh;
        }

        public void setBuildingMesh(MeshData buildingMesh) {
            this.buildingMesh = buildingMesh;
        }
    }

    /**
     * 模型数据保存请求体
     */
    public static class ModelDataRequest {
        private MeshData meshData;
        private String fileName;

        public MeshData getMeshData() {
            return meshData;
        }

        public void setMeshData(MeshData meshData) {
            this.meshData = meshData;
        }

        public String getFileName() {
            return fileName;
        }

        public void setFileName(String fileName) {
            this.fileName = fileName;
        }
    }
}
