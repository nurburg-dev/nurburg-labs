package dev.nurburg.login;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Map;

@RestController
public class AuthController {

    private final JdbcTemplate jdbc;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private final SecretKey jwtKey;

    public AuthController(
            JdbcTemplate jdbc,
            @Value("${jwt.secret:your-secret-key-change-in-production}") String secret) {
        this.jdbc = jdbc;
        this.jwtKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    @GetMapping("/healthcheck")
    public String healthcheck() {
        return "OK";
    }

    @PostMapping("/auth/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest body) {
        if (body.email() == null || body.password() == null) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Validation Error", "message", "Email and password are required"));
        }

        Map<String, Object> user;
        try {
            user = jdbc.queryForMap(
                    "SELECT id, email, name, password_hash FROM users WHERE email = ?",
                    body.email());
        } catch (EmptyResultDataAccessException e) {
            return ResponseEntity.status(401)
                    .body(Map.of("error", "Authentication Failed", "message", "Invalid email or password"));
        }

        String hash = (String) user.get("password_hash");
        if (!passwordEncoder.matches(body.password(), hash)) {
            return ResponseEntity.status(401)
                    .body(Map.of("error", "Authentication Failed", "message", "Invalid email or password"));
        }

        String token = Jwts.builder()
                .claim("userId", user.get("id"))
                .claim("email", user.get("email"))
                .signWith(jwtKey)
                .compact();

        return ResponseEntity.ok(Map.of(
                "token", token,
                "user", Map.of(
                        "id", user.get("id"),
                        "email", user.get("email"),
                        "name", user.get("name"))));
    }
}
