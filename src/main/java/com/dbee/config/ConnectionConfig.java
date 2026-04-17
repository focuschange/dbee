package com.dbee.config;

import com.dbee.model.ConnectionInfo;
import com.dbee.util.CryptoUtil;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class ConnectionConfig {
    private static final Logger log = LoggerFactory.getLogger(ConnectionConfig.class);
    private static final Path CONFIG_DIR = Path.of(System.getProperty("user.home"), ".dbee");
    private static final Path LEGACY_CONFIG_DIR = Path.of(System.getProperty("user.home"), ".dbclient");
    private static final Path CONFIG_FILE = CONFIG_DIR.resolve("connections.json");
    private static final String FILE_NAME = "connections.json";
    private final ObjectMapper mapper;

    /** Connection IDs whose passwords could not be decrypted (key changed) */
    private final Set<String> passwordReentryRequired = new HashSet<>();

    public ConnectionConfig() {
        this.mapper = new ObjectMapper();
        this.mapper.enable(SerializationFeature.INDENT_OUTPUT);
        migrateFromLegacy();
    }

    private void migrateFromLegacy() {
        Path legacyFile = LEGACY_CONFIG_DIR.resolve(FILE_NAME);
        if (Files.exists(legacyFile) && !Files.exists(CONFIG_FILE)) {
            try {
                Files.createDirectories(CONFIG_DIR);
                Files.copy(legacyFile, CONFIG_FILE);
                log.info("Migrated connections.json from ~/.dbclient/ to ~/.dbee/");
            } catch (IOException e) {
                log.warn("Failed to migrate connections.json from legacy directory", e);
            }
        }
    }

    public List<ConnectionInfo> load() {
        if (!Files.exists(CONFIG_FILE)) {
            return new ArrayList<>();
        }
        try {
            List<ConnectionInfo> connections = mapper.readValue(CONFIG_FILE.toFile(), new TypeReference<>() {});
            // Decrypt passwords on load
            boolean needsRewrite = false;
            for (ConnectionInfo conn : connections) {
                String pwd = conn.getPassword();
                if (pwd != null && !pwd.isEmpty()) {
                    if (CryptoUtil.isEncrypted(pwd)) {
                        String decrypted = CryptoUtil.decrypt(pwd);
                        if (CryptoUtil.isDecryptionFailed(decrypted)) {
                            // Decryption failed (key changed) — clear password, mark for re-entry
                            conn.setPassword("");
                            passwordReentryRequired.add(conn.getId());
                            log.warn("Password decryption failed for connection '{}' — re-entry required", conn.getName());
                        } else {
                            conn.setPassword(decrypted);
                        }
                    } else {
                        // Plaintext password found — will be encrypted on next save
                        needsRewrite = true;
                    }
                }
            }
            // Auto-encrypt existing plaintext passwords
            if (needsRewrite) {
                save(connections);
                log.info("Auto-encrypted {} connection passwords", connections.size());
            }
            return connections;
        } catch (IOException e) {
            log.error("Failed to load connections", e);
            return new ArrayList<>();
        }
    }

    /** Returns IDs of connections whose password could not be decrypted */
    public Set<String> getPasswordReentryRequired() {
        return Set.copyOf(passwordReentryRequired);
    }

    /** Mark a connection's password as successfully re-entered */
    public void clearPasswordReentry(String connectionId) {
        passwordReentryRequired.remove(connectionId);
    }

    public void save(List<ConnectionInfo> connections) {
        try {
            Files.createDirectories(CONFIG_DIR);
            // Encrypt passwords before saving
            List<ConnectionInfo> toSave = new ArrayList<>();
            for (ConnectionInfo conn : connections) {
                ConnectionInfo copy = new ConnectionInfo(
                        conn.getName(), conn.getDatabaseType(), conn.getHost(),
                        conn.getPort(), conn.getDatabase(), conn.getUsername(),
                        CryptoUtil.encrypt(conn.getPassword()));
                copy.setId(conn.getId());
                copy.setProperties(conn.getProperties());
                toSave.add(copy);
            }
            mapper.writeValue(CONFIG_FILE.toFile(), toSave);
            log.info("Saved {} connections (passwords encrypted)", connections.size());
        } catch (IOException e) {
            log.error("Failed to save connections", e);
        }
    }
}
