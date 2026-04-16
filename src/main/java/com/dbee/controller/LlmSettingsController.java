package com.dbee.controller;

import com.dbee.controller.dto.AutoCompleteMetadataDto;
import com.dbee.controller.dto.LlmChatRequest;
import com.dbee.controller.dto.LlmChatResponse;
import com.dbee.controller.dto.LlmFixSqlRequest;
import com.dbee.model.LlmSettings;
import com.dbee.service.LlmService;
import com.dbee.service.MetadataService;
import com.dbee.service.SchemaContextBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/llm")
public class LlmSettingsController {
    private static final Logger log = LoggerFactory.getLogger(LlmSettingsController.class);
    private final LlmService llmService;
    private final MetadataService metadataService;

    public LlmSettingsController(LlmService llmService, MetadataService metadataService) {
        this.llmService = llmService;
        this.metadataService = metadataService;
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

    @PostMapping("/chat")
    public LlmChatResponse chat(@RequestBody LlmChatRequest request) {
        try {
            // Build schema context from connected database
            String systemPrompt;
            if (request.connectionId() != null && !request.connectionId().isBlank()) {
                AutoCompleteMetadataDto metadata = metadataService.getAutoCompleteMetadata(request.connectionId());
                systemPrompt = SchemaContextBuilder.buildSystemPrompt(metadata);
            } else {
                systemPrompt = "You are an SQL assistant. Generate SQL queries based on the user's question. Return ONLY the SQL query.";
            }

            String response = llmService.chat(request.message(), systemPrompt);

            // Extract SQL from response (may be wrapped in markdown code blocks)
            String sql = extractSql(response);

            return LlmChatResponse.success(response, sql);
        } catch (Exception e) {
            log.error("AI chat failed: {}", e.getMessage());
            return LlmChatResponse.error(e.getMessage());
        }
    }

    @PostMapping("/fix-sql")
    public LlmChatResponse fixSql(@RequestBody LlmFixSqlRequest request) {
        try {
            // Build schema context
            String schemaContext = "";
            if (request.connectionId() != null && !request.connectionId().isBlank()) {
                try {
                    AutoCompleteMetadataDto metadata = metadataService.getAutoCompleteMetadata(request.connectionId());
                    schemaContext = "\n\nDatabase Schema:\n" + SchemaContextBuilder.buildSchemaText(metadata);
                } catch (Exception e) {
                    log.warn("Could not load schema for fix-sql: {}", e.getMessage());
                }
            }

            String systemPrompt = """
                    You are an expert SQL debugger. The user executed a SQL query that resulted in an error.
                    Analyze the error, explain the cause briefly, and provide a corrected SQL query.

                    Format your response as:
                    1. A brief explanation of what went wrong (1-2 sentences)
                    2. The corrected SQL in a ```sql code block

                    Keep your explanation concise and focused on the fix.""" + schemaContext;

            String userMessage = "SQL Query:\n```sql\n" + request.sql() + "\n```\n\nError:\n" + request.errorMessage();

            String response = llmService.chat(userMessage, systemPrompt);
            String sql = extractSql(response);

            return LlmChatResponse.success(response, sql);
        } catch (Exception e) {
            log.error("AI fix-sql failed: {}", e.getMessage());
            return LlmChatResponse.error(e.getMessage());
        }
    }

    /**
     * Extract SQL from LLM response. Handles markdown code blocks and plain SQL.
     */
    private String extractSql(String response) {
        if (response == null || response.isBlank()) return null;

        // Try to extract from ```sql ... ``` code block
        String text = response.trim();
        int sqlBlockStart = text.indexOf("```sql");
        if (sqlBlockStart >= 0) {
            int codeStart = text.indexOf('\n', sqlBlockStart) + 1;
            int codeEnd = text.indexOf("```", codeStart);
            if (codeEnd > codeStart) {
                return text.substring(codeStart, codeEnd).trim();
            }
        }

        // Try generic ``` ... ``` block
        int blockStart = text.indexOf("```");
        if (blockStart >= 0) {
            int codeStart = text.indexOf('\n', blockStart) + 1;
            int codeEnd = text.indexOf("```", codeStart);
            if (codeEnd > codeStart) {
                return text.substring(codeStart, codeEnd).trim();
            }
        }

        // If it looks like plain SQL (starts with common keywords), return as-is
        String upper = text.toUpperCase().stripLeading();
        if (upper.startsWith("SELECT") || upper.startsWith("INSERT") || upper.startsWith("UPDATE") ||
            upper.startsWith("DELETE") || upper.startsWith("CREATE") || upper.startsWith("ALTER") ||
            upper.startsWith("DROP") || upper.startsWith("WITH")) {
            return text;
        }

        return null;
    }

    @PostMapping("/schema-review")
    public LlmChatResponse schemaReview(@RequestBody LlmChatRequest request) {
        try {
            String schemaContext = "";
            if (request.connectionId() != null && !request.connectionId().isBlank()) {
                try {
                    var metadata = metadataService.getAutoCompleteMetadata(request.connectionId());
                    schemaContext = "\n\nDatabase Schema:\n" + SchemaContextBuilder.buildSchemaText(metadata);
                } catch (Exception ignored) {}
            }
            String systemPrompt = """
                    You are a database architect. Review the schema and provide:
                    1. Normalization issues (if any)
                    2. Missing indexes that would help common queries
                    3. Naming convention suggestions
                    4. Relationship improvements
                    Be concise with actionable recommendations.""" + schemaContext;
            String response = llmService.chat(request.message(), systemPrompt);
            String sql = extractSql(response);
            return LlmChatResponse.success(response, sql);
        } catch (Exception e) {
            return LlmChatResponse.error(e.getMessage());
        }
    }

    @PostMapping("/alter-sql")
    public LlmChatResponse alterSql(@RequestBody LlmChatRequest request) {
        try {
            String schemaContext = "";
            if (request.connectionId() != null && !request.connectionId().isBlank()) {
                try {
                    var metadata = metadataService.getAutoCompleteMetadata(request.connectionId());
                    schemaContext = "\n\nDatabase Schema:\n" + SchemaContextBuilder.buildSchemaText(metadata);
                } catch (Exception ignored) {}
            }
            String systemPrompt = """
                    You are an SQL expert. The user will describe a schema change in natural language.
                    Generate the appropriate ALTER TABLE / CREATE INDEX / DROP statements.
                    Return ONLY the SQL in a ```sql code block. No explanations.""" + schemaContext;
            String response = llmService.chat(request.message(), systemPrompt);
            String sql = extractSql(response);
            return LlmChatResponse.success(response, sql);
        } catch (Exception e) {
            return LlmChatResponse.error(e.getMessage());
        }
    }

    @PostMapping("/index-hint")
    public LlmChatResponse indexHint(@RequestBody LlmChatRequest request) {
        try {
            String schemaContext = "";
            if (request.connectionId() != null && !request.connectionId().isBlank()) {
                try {
                    var metadata = metadataService.getAutoCompleteMetadata(request.connectionId());
                    schemaContext = "\n\nDatabase Schema:\n" + SchemaContextBuilder.buildSchemaText(metadata);
                } catch (Exception ignored) {}
            }
            String systemPrompt = """
                    You are a database index optimization expert. Analyze the SQL query and suggest
                    indexes that would improve its performance. For each suggestion:
                    1. Which table and columns to index
                    2. Whether it should be a composite index
                    3. The CREATE INDEX statement
                    Be concise and practical.""" + schemaContext;
            String response = llmService.chat("Suggest indexes for:\n```sql\n" + request.message() + "\n```", systemPrompt);
            String sql = extractSql(response);
            return LlmChatResponse.success(response, sql);
        } catch (Exception e) {
            return LlmChatResponse.error(e.getMessage());
        }
    }

    @PostMapping("/explain-sql")
    public LlmChatResponse explainSql(@RequestBody LlmChatRequest request) {
        try {
            String systemPrompt = """
                    You are an SQL expert. Explain what the given SQL query does in clear, concise language.
                    Break down each part: tables involved, joins, conditions, aggregations, etc.
                    Use bullet points for clarity. Keep it under 200 words.""";
            String response = llmService.chat("Explain this SQL:\n```sql\n" + request.message() + "\n```", systemPrompt);
            return LlmChatResponse.success(response, null);
        } catch (Exception e) {
            return LlmChatResponse.error(e.getMessage());
        }
    }

    @PostMapping("/optimize-sql")
    public LlmChatResponse optimizeSql(@RequestBody LlmChatRequest request) {
        try {
            String schemaContext = "";
            if (request.connectionId() != null && !request.connectionId().isBlank()) {
                try {
                    var metadata = metadataService.getAutoCompleteMetadata(request.connectionId());
                    schemaContext = "\n\nDatabase Schema:\n" + SchemaContextBuilder.buildSchemaText(metadata);
                } catch (Exception ignored) {}
            }
            String systemPrompt = """
                    You are an SQL performance expert. Analyze the given SQL query and suggest optimizations.
                    Consider: index usage, join order, subquery elimination, proper filtering.
                    If you suggest a rewritten query, put it in a ```sql code block.
                    Be concise and practical.""" + schemaContext;
            String response = llmService.chat("Optimize this SQL:\n```sql\n" + request.message() + "\n```", systemPrompt);
            String sql = extractSql(response);
            return LlmChatResponse.success(response, sql);
        } catch (Exception e) {
            return LlmChatResponse.error(e.getMessage());
        }
    }

    @PostMapping("/analyze-result")
    public LlmChatResponse analyzeResult(@RequestBody LlmChatRequest request) {
        try {
            String systemPrompt = """
                    You are a data analyst. The user will provide a SQL query and its results.
                    Analyze the data and provide insights: patterns, anomalies, statistics, trends.
                    Be concise (under 200 words) and use bullet points.""";
            String response = llmService.chat(request.message(), systemPrompt);
            return LlmChatResponse.success(response, null);
        } catch (Exception e) {
            return LlmChatResponse.error(e.getMessage());
        }
    }

    @GetMapping("/ollama-models")
    public java.util.List<String> ollamaModels(@RequestParam(defaultValue = "http://localhost:11434") String baseUrl) {
        try {
            var request = java.net.http.HttpRequest.newBuilder()
                    .uri(java.net.URI.create(baseUrl + "/api/tags"))
                    .GET().timeout(java.time.Duration.ofSeconds(5)).build();
            var response = java.net.http.HttpClient.newHttpClient()
                    .send(request, java.net.http.HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                var json = new com.fasterxml.jackson.databind.ObjectMapper().readTree(response.body());
                var models = new java.util.ArrayList<String>();
                json.path("models").forEach(m -> models.add(m.path("name").asText()));
                return models;
            }
        } catch (Exception e) {
            log.warn("Failed to list Ollama models: {}", e.getMessage());
        }
        return java.util.List.of();
    }

    private String maskApiKey(String apiKey) {
        if (apiKey == null || apiKey.isBlank()) return "";
        if (apiKey.length() <= 8) return "••••";
        return apiKey.substring(0, 4) + "••••" + apiKey.substring(apiKey.length() - 4);
    }
}
