package com.dbee.model;

public enum LlmProvider {
    OPENAI("OpenAI", "https://api.openai.com/v1", "gpt-4o"),
    CLAUDE("Claude", "https://api.anthropic.com/v1", "claude-sonnet-4-20250514"),
    OLLAMA("Ollama", "http://localhost:11434", "llama3");

    private final String displayName;
    private final String defaultBaseUrl;
    private final String defaultModel;

    LlmProvider(String displayName, String defaultBaseUrl, String defaultModel) {
        this.displayName = displayName;
        this.defaultBaseUrl = defaultBaseUrl;
        this.defaultModel = defaultModel;
    }

    public String getDisplayName() { return displayName; }
    public String getDefaultBaseUrl() { return defaultBaseUrl; }
    public String getDefaultModel() { return defaultModel; }
}
