package com.skypath.backend.entity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

/**
 * Project entity for MongoDB
 * Represents a 3D visualization project containing .obj data
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "projects")
public class Project {

    @Id
    private String id;

    private String name;

    private String description;

    private String userId;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    public Project(String name, String description, String userId) {
        this.name = name;
        this.description = description;
        this.userId = userId;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }
}
