package com.dbee.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

/**
 * Manages optional application access PIN stored in ~/.dbee/app-security.json
 */
public class AppSecurityConfig {
    private static final Logger log = LoggerFactory.getLogger(AppSecurityConfig.class);
    private static final Path CONFIG_DIR = Path.of(System.getProperty("user.home"), ".dbee");
    private static final Path CONFIG_FILE = CONFIG_DIR.resolve("app-security.json");
    private final ObjectMapper mapper = new ObjectMapper().enable(SerializationFeature.INDENT_OUTPUT);

    public String getPin() {
        if (!Files.exists(CONFIG_FILE)) return null;
        try {
            var map = mapper.readValue(CONFIG_FILE.toFile(), Map.class);
            Object pin = map.get("pin");
            return pin != null ? pin.toString() : null;
        } catch (IOException e) {
            log.error("Failed to read app security config", e);
            return null;
        }
    }

    public void setPin(String pin) {
        try {
            Files.createDirectories(CONFIG_DIR);
            if (pin == null || pin.isBlank()) {
                Files.deleteIfExists(CONFIG_FILE);
            } else {
                // Store as SHA-256 hash instead of plaintext
                String hash = hashPin(pin);
                mapper.writeValue(CONFIG_FILE.toFile(), Map.of("pin", hash));
            }
        } catch (IOException e) {
            log.error("Failed to save app security config", e);
        }
    }

    public boolean isEnabled() {
        String pin = getPin();
        return pin != null && !pin.isBlank();
    }

    public boolean verify(String input) {
        String storedHash = getPin();
        if (storedHash == null || input == null) return false;
        // Constant-time comparison of hashes
        String inputHash = hashPin(input);
        return java.security.MessageDigest.isEqual(
                storedHash.getBytes(), inputHash.getBytes());
    }

    private String hashPin(String pin) {
        try {
            java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(("DBee-PIN-Salt:" + pin).getBytes());
            StringBuilder hex = new StringBuilder();
            for (byte b : hash) hex.append(String.format("%02x", b));
            return hex.toString();
        } catch (Exception e) {
            throw new RuntimeException("Failed to hash PIN", e);
        }
    }
}
