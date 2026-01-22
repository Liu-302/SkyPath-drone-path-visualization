package com.skypath.backend.entity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Map;

/**
 * Waypoint entity for MongoDB
 * Stores waypoint data for flight paths
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "waypoints")
public class Waypoint {

    @Id
    private String id;

    private String projectId;

    private String name;

    // Position coordinates
    private Double x;
    private Double y;
    private Double z;

    // Normal vector for camera orientation
    private Double normalX;
    private Double normalY;
    private Double normalZ;

    // Camera angles
    private Double pitch;
    private Double yaw;
    private Double roll;

    private Integer sequenceOrder;

    private Map<String, Object> metadata;
}
