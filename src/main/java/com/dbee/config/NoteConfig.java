package com.dbee.config;

import com.dbee.model.NoteInfo;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

public class NoteConfig {
    private static final Logger log = LoggerFactory.getLogger(NoteConfig.class);
    private static final Path CONFIG_DIR = Path.of(System.getProperty("user.home"), ".dbee");
    private static final Path LEGACY_CONFIG_DIR = Path.of(System.getProperty("user.home"), ".dbclient");
    private static final Path CONFIG_FILE = CONFIG_DIR.resolve("notes.json");
    private static final String FILE_NAME = "notes.json";
    private final ObjectMapper mapper;

    public NoteConfig() {
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
                log.info("Migrated notes.json from ~/.dbclient/ to ~/.dbee/");
            } catch (IOException e) {
                log.warn("Failed to migrate notes.json from legacy directory", e);
            }
        }
    }

    public List<NoteInfo> load() {
        if (!Files.exists(CONFIG_FILE)) {
            return new ArrayList<>();
        }
        try {
            return mapper.readValue(CONFIG_FILE.toFile(), new TypeReference<>() {});
        } catch (IOException e) {
            log.error("Failed to load notes", e);
            return new ArrayList<>();
        }
    }

    public void save(List<NoteInfo> notes) {
        try {
            Files.createDirectories(CONFIG_DIR);
            mapper.writeValue(CONFIG_FILE.toFile(), notes);
            log.info("Saved {} notes", notes.size());
        } catch (IOException e) {
            log.error("Failed to save notes", e);
        }
    }
}
