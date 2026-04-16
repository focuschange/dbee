package com.dbee.config;

import com.dbee.model.SavedQueryInfo;
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

public class SavedQueryConfig {
    private static final Logger log = LoggerFactory.getLogger(SavedQueryConfig.class);
    private static final Path CONFIG_DIR = Path.of(System.getProperty("user.home"), ".dbee");
    private static final Path CONFIG_FILE = CONFIG_DIR.resolve("saved-queries.json");
    private final ObjectMapper mapper;

    public SavedQueryConfig() {
        this.mapper = new ObjectMapper();
        this.mapper.enable(SerializationFeature.INDENT_OUTPUT);
    }

    public List<SavedQueryInfo> load() {
        if (!Files.exists(CONFIG_FILE)) return new ArrayList<>();
        try {
            return mapper.readValue(CONFIG_FILE.toFile(), new TypeReference<>() {});
        } catch (IOException e) {
            log.error("Failed to load saved queries", e);
            return new ArrayList<>();
        }
    }

    public void save(List<SavedQueryInfo> queries) {
        try {
            Files.createDirectories(CONFIG_DIR);
            mapper.writeValue(CONFIG_FILE.toFile(), queries);
        } catch (IOException e) {
            log.error("Failed to save queries", e);
        }
    }
}
