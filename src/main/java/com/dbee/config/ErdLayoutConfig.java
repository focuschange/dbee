package com.dbee.config;

import com.dbee.model.ErdLayout;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Persists ERD layouts (node positions + zoom/pan) to ~/.dbee/erd-layouts/.
 * One file per (connectionId, schema) pair.
 */
@Component
public class ErdLayoutConfig {
    private static final Logger log = LoggerFactory.getLogger(ErdLayoutConfig.class);
    private static final Path LAYOUT_DIR = Path.of(System.getProperty("user.home"), ".dbee", "erd-layouts");
    private final ObjectMapper mapper;

    public ErdLayoutConfig() {
        this.mapper = new ObjectMapper();
        this.mapper.enable(SerializationFeature.INDENT_OUTPUT);
    }

    private Path layoutFile(String connectionId, String schema) {
        // Sanitize schema for filesystem safety
        String safeSchema = schema == null ? "_" : schema.replaceAll("[^a-zA-Z0-9._-]", "_");
        String safeConn = connectionId == null ? "_" : connectionId.replaceAll("[^a-zA-Z0-9._-]", "_");
        return LAYOUT_DIR.resolve(safeConn + "__" + safeSchema + ".json");
    }

    public ErdLayout load(String connectionId, String schema) {
        Path file = layoutFile(connectionId, schema);
        if (!Files.exists(file)) return null;
        try {
            return mapper.readValue(file.toFile(), ErdLayout.class);
        } catch (IOException e) {
            log.warn("Failed to load ERD layout: {} / {}", connectionId, schema, e);
            return null;
        }
    }

    public void save(String connectionId, String schema, ErdLayout layout) {
        try {
            Files.createDirectories(LAYOUT_DIR);
            layout.setUpdatedAt(java.time.Instant.now().toString());
            mapper.writeValue(layoutFile(connectionId, schema).toFile(), layout);
        } catch (IOException e) {
            log.error("Failed to save ERD layout: {} / {}", connectionId, schema, e);
        }
    }

    public void delete(String connectionId, String schema) {
        Path file = layoutFile(connectionId, schema);
        try {
            Files.deleteIfExists(file);
        } catch (IOException e) {
            log.warn("Failed to delete ERD layout: {} / {}", connectionId, schema, e);
        }
    }

    /**
     * Deletes all layouts for a connection (cascade on connection deletion).
     */
    public void deleteAllForConnection(String connectionId) {
        if (!Files.exists(LAYOUT_DIR)) return;
        String safeConn = connectionId == null ? "_" : connectionId.replaceAll("[^a-zA-Z0-9._-]", "_");
        String prefix = safeConn + "__";
        try (var stream = Files.list(LAYOUT_DIR)) {
            stream.filter(p -> p.getFileName().toString().startsWith(prefix))
                  .forEach(p -> {
                      try { Files.deleteIfExists(p); } catch (IOException ignored) {}
                  });
        } catch (IOException e) {
            log.warn("Failed to cascade-delete ERD layouts for connection: {}", connectionId, e);
        }
    }
}
