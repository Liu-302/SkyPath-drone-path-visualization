package com.skypath.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Main application class for SkyPath Backend
 */
@SpringBootApplication
public class SkyPathBackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(SkyPathBackendApplication.class, args);
        System.out.println("========================================");
        System.out.println("SkyPath Backend started successfully!");
        System.out.println("API available at: http://localhost:8080");
        System.out.println("========================================");
    }
}
