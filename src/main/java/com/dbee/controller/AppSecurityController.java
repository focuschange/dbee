package com.dbee.controller;

import com.dbee.config.AppSecurityConfig;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/security")
public class AppSecurityController {
    private final AppSecurityConfig config;

    public AppSecurityController(AppSecurityConfig config) {
        this.config = config;
    }

    @GetMapping("/status")
    public Map<String, Object> status() {
        return Map.of("enabled", config.isEnabled());
    }

    @PostMapping("/verify")
    public Map<String, Object> verify(@RequestBody Map<String, String> body) {
        String pin = body.get("pin");
        boolean ok = config.verify(pin);
        return Map.of("verified", ok);
    }

    @PostMapping("/set-pin")
    public Map<String, Object> setPin(@RequestBody Map<String, String> body) {
        String pin = body.get("pin");
        config.setPin(pin);
        return Map.of("success", true, "enabled", pin != null && !pin.isBlank());
    }

    @PostMapping("/remove-pin")
    public Map<String, Object> removePin() {
        config.setPin(null);
        return Map.of("success", true, "enabled", false);
    }
}
