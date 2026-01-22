package com.skypath.backend.repository;

import com.skypath.backend.entity.Project;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository for Project entity
 */
@Repository
public interface ProjectRepository extends MongoRepository<Project, String> {

    List<Project> findByUserId(String userId);

    List<Project> findByUserIdOrderByUpdatedAtDesc(String userId);

    Project findByNameAndUserId(String name, String userId);

    boolean existsByNameAndUserId(String name, String userId);

    List<Project> findByUserIdAndNameContaining(String userId, String nameKeyword);
}
