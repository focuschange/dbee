package com.dbee.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class LlmSettings {
    private LlmProvider provider;
    private String apiKey;
    private String baseUrl;
    private String model;
    private double temperature;

    public LlmSettings() {
        this.provider = LlmProvider.OPENAI;
        this.apiKey = "";
        this.baseUrl = LlmProvider.OPENAI.getDefaultBaseUrl();
        this.model = LlmProvider.OPENAI.getDefaultModel();
        this.temperature = 0.3;
    }

    public LlmProvider getProvider() { return provider; }
    public void setProvider(LlmProvider provider) { this.provider = provider; }

    public String getApiKey() { return apiKey; }
    public void setApiKey(String apiKey) { this.apiKey = apiKey; }

    public String getBaseUrl() { return baseUrl; }
    public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }

    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }

    public double getTemperature() { return temperature; }
    public void setTemperature(double temperature) { this.temperature = temperature; }

    public boolean isConfigured() {
        if (provider == LlmProvider.OLLAMA) {
            return baseUrl != null && !baseUrl.isBlank();
        }
        return apiKey != null && !apiKey.isBlank();
    }
}
