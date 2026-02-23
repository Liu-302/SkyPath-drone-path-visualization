package com.skypath.backend.service;

import com.skypath.backend.dto.LoginRequest;
import com.skypath.backend.dto.LoginResponse;
import com.skypath.backend.dto.RegisterRequest;
import com.skypath.backend.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserService userService;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;

    public Optional<LoginResponse> login(LoginRequest request) {
        Optional<User> userOpt = userService.getUserByEmail(request.getEmail());
        if (userOpt.isEmpty()) {
            return Optional.empty();
        }
        User user = userOpt.get();
        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            return Optional.empty();
        }
        String token = jwtService.generateToken(user.getId(), user.getEmail());
        return Optional.of(new LoginResponse(
                token,
                user.getId(),
                user.getUsername(),
                user.getEmail()
        ));
    }

    public Optional<LoginResponse> register(RegisterRequest request) {
        if (userService.existsByEmail(request.getEmail())) {
            return Optional.empty();
        }
        if (userService.existsByUsername(request.getUsername())) {
            return Optional.empty();
        }
        User user = new User(request.getUsername(), request.getEmail(), request.getPassword());
        User created = userService.createUser(user);
        String token = jwtService.generateToken(created.getId(), created.getEmail());
        return Optional.of(new LoginResponse(
                token,
                created.getId(),
                created.getUsername(),
                created.getEmail()
        ));
    }
}
