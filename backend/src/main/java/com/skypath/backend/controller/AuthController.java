package com.skypath.backend.controller;

import com.skypath.backend.dto.LoginRequest;
import com.skypath.backend.dto.LoginResponse;
import com.skypath.backend.dto.RegisterRequest;
import com.skypath.backend.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.status(HttpStatus.UNAUTHORIZED).build());
    }

    @PostMapping("/register")
    public ResponseEntity<LoginResponse> register(@Valid @RequestBody RegisterRequest request) {
        return authService.register(request)
                .map(res -> ResponseEntity.status(HttpStatus.CREATED).body(res))
                .orElse(ResponseEntity.status(HttpStatus.CONFLICT).build());
    }
}
