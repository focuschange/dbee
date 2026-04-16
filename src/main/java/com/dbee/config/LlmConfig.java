package com.dbee.config;

import com.dbee.model.LlmSettings;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

public class LlmConfig {
    private static final Logger log = LoggerFactory.getLogger(LlmConfig.class);
    private static final Path CONFIG_DIR = Path.of(System.getProperty("user.home"), ".dbee");
    private static final Path CONFIG_FILE = CONFIG_DIR.resolve("llm-settings.json");
    private final ObjectMapper mapper;

    public LlmConfig() {
        this.mapper = new ObjectMapper();
        this.mapper.enable(SerializationFeature.INDENT_OUTPUT);
    }

    public LlmSettings load() {
        if (!Files.exists(CONFIG_FILE)) {
            return new LlmSettings();
        }
        try {
            return mapper.readValue(CONFIG_FILE.toFile(), LlmSettings.class);
        } catch (IOException e) {
            log.error("Failed to load LLM settings", e);
            return new LlmSettings();
        }
    }

    public void save(LlmSettings settings) {
        try {
            Files.createDirectories(CONFIG_DIR);
            mapper.writeValue(CONFIG_FILE.toFile(), settings);
            log.info("Saved LLM settings (provider: {})", settings.getProvider());
        } catch (IOException e) {
            log.error("Failed to save LLM settings", e);
        }
    }
}
