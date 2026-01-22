package com.skypath.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * DTO for KPI metrics response
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class KPIMetrics {
    private Double pathLength;
    private Double flightTime;
    private Double coverage;
    private Double overlap;
    private Integer collisionCount;
    private Boolean hasCollision;
    private Double energy;
    private String status;
    private Integer progress;
    /** 碰撞详情列表 */
    private List<CollisionPoint> collisionDetails;
}
