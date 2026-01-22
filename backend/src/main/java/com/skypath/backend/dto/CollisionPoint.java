package com.skypath.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 碰撞点DTO
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CollisionPoint {
    /** 碰撞点X坐标 */
    private double x;

    /** 碰撞点Y坐标 */
    private double y;

    /** 碰撞点Z坐标 */
    private double z;

    /** 碰撞严重程度(0-1) */
    private double severity;

    /** 碰撞时间(相对于路径开始的索引) */
    private int time;
}
