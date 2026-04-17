package com.dbee.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Audit log for tracking all query executions.
 * Stored as daily JSON files in ~/.dbee/audit/YYYY-MM-DD.json
 */
public class AuditLogConfig {
    private static final Logger log = LoggerFactory.getLogger(AuditLogConfig.class);
    private static final Path AUDIT_DIR = Path.of(System.getProperty("user.home"), ".dbee", "audit");
    private final ObjectMapper mapper = new ObjectMapper().enable(SerializationFeature.INDENT_OUTPUT);

    public void logQuery(String connectionId, String connectionName, String sql, boolean success, long executionTimeMs) {
        try {
            Files.createDirectories(AUDIT_DIR);
            String dateKey = LocalDate.now().toString();
            Path file = AUDIT_DIR.resolve(dateKey + ".json");

            List<Map<String, Object>> entries = loadFile(file);
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("timestamp", LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
            entry.put("connectionId", connectionId);
            entry.put("connectionName", connectionName);
            entry.put("sql", sql.length() > 2000 ? sql.substring(0, 2000) + "..." : sql);
            entry.put("success", success);
            entry.put("executionTimeMs", executionTimeMs);
            entry.put("user", System.getProperty("user.name"));
            entries.add(entry);

            mapper.writeValue(file.toFile(), entries);
        } catch (IOException e) {
            log.warn("Failed to write audit log: {}", e.getMessage());
        }
    }

    public List<Map<String, Object>> getRecentLogs(int limit) {
        List<Map<String, Object>> all = new ArrayList<>();
        try {
            if (!Files.exists(AUDIT_DIR)) return all;
            List<Path> files = Files.list(AUDIT_DIR)
                    .filter(p -> p.toString().endsWith(".json"))
                    .sorted(Comparator.reverseOrder())
                    .limit(7) // last 7 days
                    .toList();
            for (Path f : files) {
                all.addAll(loadFile(f));
                if (all.size() >= limit) break;
            }
        } catch (IOException e) {
            log.warn("Failed to read audit logs: {}", e.getMessage());
        }
        all.sort((a, b) -> String.valueOf(b.get("timestamp")).compareTo(String.valueOf(a.get("timestamp"))));
        return all.size() > limit ? all.subList(0, limit) : all;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> loadFile(Path file) {
        if (!Files.exists(file)) return new ArrayList<>();
        try {
            return mapper.readValue(file.toFile(), List.class);
        } catch (IOException e) {
            return new ArrayList<>();
        }
    }
}
