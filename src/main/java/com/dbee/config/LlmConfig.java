package com.dbee.config;

import com.dbee.model.LlmSettings;
import com.dbee.util.CryptoUtil;
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
            LlmSettings settings = mapper.readValue(CONFIG_FILE.toFile(), LlmSettings.class);
            // Decrypt API key on load
            settings.setApiKey(CryptoUtil.decrypt(settings.getApiKey()));
            return settings;
        } catch (IOException e) {
            log.error("Failed to load LLM settings", e);
            return new LlmSettings();
        }
    }

    public void save(LlmSettings settings) {
        try {
            Files.createDirectories(CONFIG_DIR);
            // Encrypt API key before saving
            LlmSettings toSave = new LlmSettings();
            toSave.setProvider(settings.getProvider());
            toSave.setApiKey(CryptoUtil.encrypt(settings.getApiKey()));
            toSave.setBaseUrl(settings.getBaseUrl());
            toSave.setModel(settings.getModel());
            toSave.setTemperature(settings.getTemperature());
            mapper.writeValue(CONFIG_FILE.toFile(), toSave);
            log.info("Saved LLM settings (provider: {}, key encrypted)", settings.getProvider());
        } catch (IOException e) {
            log.error("Failed to save LLM settings", e);
        }
    }
}
