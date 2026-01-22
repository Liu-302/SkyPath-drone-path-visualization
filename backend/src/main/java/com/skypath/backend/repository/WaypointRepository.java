package com.skypath.backend.repository;

import com.skypath.backend.entity.Waypoint;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository for Waypoint entity
 */
@Repository
public interface WaypointRepository extends MongoRepository<Waypoint, String> {

    List<Waypoint> findByProjectId(String projectId);

    List<Waypoint> findByProjectIdOrderBySequenceOrder(String projectId);

    List<Waypoint> findByProjectIdOrderBySequenceOrderAsc(String projectId);

    void deleteByProjectId(String projectId);
}
