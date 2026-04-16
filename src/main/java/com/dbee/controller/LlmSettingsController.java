package com.dbee.controller;

import com.dbee.model.LlmSettings;
import com.dbee.service.LlmService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/llm")
public class LlmSettingsController {
    private final LlmService llmService;

    public LlmSettingsController(LlmService llmService) {
        this.llmService = llmService;
    }

    @GetMapping("/settings")
    public LlmSettings getSettings() {
        LlmSettings settings = llmService.getSettings();
        // Mask API key for security
        LlmSettings masked = new LlmSettings();
        masked.setProvider(settings.getProvider());
        masked.setApiKey(maskApiKey(settings.getApiKey()));
        masked.setBaseUrl(settings.getBaseUrl());
        masked.setModel(settings.getModel());
        masked.setTemperature(settings.getTemperature());
        return masked;
    }

    @PostMapping("/settings")
    public Map<String, Object> saveSettings(@RequestBody LlmSettings settings) {
        // If API key is masked (not changed), keep the existing one
        LlmSettings existing = llmService.getSettings();
        if (settings.getApiKey() != null && settings.getApiKey().contains("••••")) {
            settings.setApiKey(existing.getApiKey());
        }
        llmService.saveSettings(settings);
        return Map.of("success", true, "message", "Settings saved");
    }

    @PostMapping("/test")
    public Map<String, Object> testConnection(@RequestBody LlmSettings settings) {
        // If API key is masked, use existing
        if (settings.getApiKey() != null && settings.getApiKey().contains("••••")) {
            LlmSettings existing = llmService.getSettings();
            settings.setApiKey(existing.getApiKey());
        }
        return llmService.testConnection(settings);
    }

    @GetMapping("/providers")
    public Map<String, Object>[] getProviders() {
        var providers = com.dbee.model.LlmProvider.values();
        @SuppressWarnings("unchecked")
        Map<String, Object>[] result = new Map[providers.length];
        for (int i = 0; i < providers.length; i++) {
            result[i] = Map.of(
                    "name", providers[i].name(),
                    "displayName", providers[i].getDisplayName(),
                    "defaultBaseUrl", providers[i].getDefaultBaseUrl(),
                    "defaultModel", providers[i].getDefaultModel()
            );
        }
        return result;
    }

    private String maskApiKey(String apiKey) {
        if (apiKey == null || apiKey.isBlank()) return "";
        if (apiKey.length() <= 8) return "••••";
        return apiKey.substring(0, 4) + "••••" + apiKey.substring(apiKey.length() - 4);
    }
}
