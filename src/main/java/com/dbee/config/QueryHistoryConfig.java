package com.dbee.config;

import com.dbee.model.QueryHistory;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Manages query history persistence as daily JSON files.
 * Storage: ~/.dbee/history/YYYY-MM-DD.json
 *
 * Also handles one-time migration from the legacy single-file format
 * (~/.dbee/history.json) to daily files.
 */
public class QueryHistoryConfig {
    private static final Logger log = LoggerFactory.getLogger(QueryHistoryConfig.class);
    private static final Path CONFIG_DIR = Path.of(System.getProperty("user.home"), ".dbee");
    private static final Path HISTORY_DIR = CONFIG_DIR.resolve("history");
    private static final Path LEGACY_FILE = CONFIG_DIR.resolve("history.json");
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private final ObjectMapper mapper;

    public QueryHistoryConfig() {
        this.mapper = new ObjectMapper();
        this.mapper.enable(SerializationFeature.INDENT_OUTPUT);
        migrateFromLegacy();
    }

    /**
     * Migrate legacy single history.json to daily files.
     */
    private void migrateFromLegacy() {
        if (!Files.exists(LEGACY_FILE)) return;
        try {
            List<QueryHistory> all = mapper.readValue(LEGACY_FILE.toFile(), new TypeReference<>() {});
            if (!all.isEmpty()) {
                for (QueryHistory entry : all) {
                    String dateKey = toDateKey(entry.getExecutedAt());
                    List<QueryHistory> daily = loadDate(dateKey);
                    daily.add(entry);
                    saveDate(dateKey, daily);
                }
                log.info("Migrated {} history entries from legacy history.json to daily files", all.size());
            }
            Files.delete(LEGACY_FILE);
        } catch (IOException e) {
            log.warn("Failed to migrate legacy history.json", e);
        }
    }

    /**
     * Load history entries for a specific date.
     */
    public List<QueryHistory> loadDate(String dateKey) {
        Path file = HISTORY_DIR.resolve(dateKey + ".json");
        if (!Files.exists(file)) {
            return new ArrayList<>();
        }
        try {
            return new ArrayList<>(mapper.readValue(file.toFile(), new TypeReference<>() {}));
        } catch (IOException e) {
            log.error("Failed to load history for {}", dateKey, e);
            return new ArrayList<>();
        }
    }

    /**
     * Save history entries for a specific date.
     */
    public void saveDate(String dateKey, List<QueryHistory> entries) {
        try {
            Files.createDirectories(HISTORY_DIR);
            Path file = HISTORY_DIR.resolve(dateKey + ".json");
            if (entries.isEmpty()) {
                Files.deleteIfExists(file);
            } else {
                mapper.writeValue(file.toFile(), entries);
            }
        } catch (IOException e) {
            log.error("Failed to save history for {}", dateKey, e);
        }
    }

    /**
     * List all available date keys (sorted descending — newest first).
     */
    public List<String> listDateKeys() {
        if (!Files.exists(HISTORY_DIR)) return Collections.emptyList();
        List<String> keys = new ArrayList<>();
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(HISTORY_DIR, "*.json")) {
            for (Path path : stream) {
                String name = path.getFileName().toString();
                keys.add(name.replace(".json", ""));
            }
        } catch (IOException e) {
            log.error("Failed to list history date keys", e);
        }
        keys.sort(Collections.reverseOrder());
        return keys;
    }

    /**
     * Delete all history files.
     */
    public void clearAll() {
        if (!Files.exists(HISTORY_DIR)) return;
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(HISTORY_DIR, "*.json")) {
            for (Path path : stream) {
                Files.delete(path);
            }
        } catch (IOException e) {
            log.error("Failed to clear history", e);
        }
    }

    /**
     * Convert a timestamp to a date key string (yyyy-MM-dd).
     */
    public static String toDateKey(long timestamp) {
        return Instant.ofEpochMilli(timestamp)
                .atZone(ZoneId.systemDefault())
                .toLocalDate()
                .format(DATE_FMT);
    }

    /**
     * Get today's date key.
     */
    public static String todayKey() {
        return LocalDate.now().format(DATE_FMT);
    }
}
