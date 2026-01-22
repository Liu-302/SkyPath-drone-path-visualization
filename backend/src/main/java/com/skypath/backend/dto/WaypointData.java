package com.skypath.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO for waypoint data
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class WaypointData {
    private Double x;
    private Double y;
    private Double z;
    private Double normalX;
    private Double normalY;
    private Double normalZ;
}
