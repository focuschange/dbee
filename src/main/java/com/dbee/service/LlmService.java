package com.dbee.service;

import com.dbee.config.LlmConfig;
import com.dbee.model.LlmProvider;
import com.dbee.model.LlmSettings;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;

@Service
public class LlmService {
    private static final Logger log = LoggerFactory.getLogger(LlmService.class);
    private final LlmConfig llmConfig;
    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient httpClient;

    public LlmService(LlmConfig llmConfig) {
        this.llmConfig = llmConfig;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    public LlmSettings getSettings() {
        return llmConfig.load();
    }

    public void saveSettings(LlmSettings settings) {
        llmConfig.save(settings);
    }

    /**
     * Test the LLM connection with a simple prompt.
     * @return success message or error message
     */
    public Map<String, Object> testConnection(LlmSettings settings) {
        try {
            String response = chat(settings, "Say 'Hello' in one word.");
            return Map.of("success", true, "message", "Connection successful: " + response);
        } catch (Exception e) {
            log.error("LLM connection test failed: {}", e.getMessage());
            return Map.of("success", false, "message", e.getMessage());
        }
    }

    /**
     * Send a chat message to the configured LLM and return the response text.
     */
    public String chat(LlmSettings settings, String userMessage) {
        return chat(settings, userMessage, null);
    }

    /**
     * Send a chat message with optional system prompt.
     */
    public String chat(LlmSettings settings, String userMessage, String systemPrompt) {
        return switch (settings.getProvider()) {
            case OPENAI -> callOpenAi(settings, userMessage, systemPrompt);
            case CLAUDE -> callClaude(settings, userMessage, systemPrompt);
            case OLLAMA -> callOllama(settings, userMessage, systemPrompt);
        };
    }

    /**
     * Chat using the saved settings.
     */
    public String chat(String userMessage, String systemPrompt) {
        LlmSettings settings = llmConfig.load();
        if (!settings.isConfigured()) {
            throw new RuntimeException("LLM is not configured. Please set up your LLM provider in Settings.");
        }
        return chat(settings, userMessage, systemPrompt);
    }

    private String callOpenAi(LlmSettings settings, String userMessage, String systemPrompt) {
        try {
            ObjectNode body = mapper.createObjectNode();
            body.put("model", settings.getModel());
            body.put("temperature", settings.getTemperature());

            ArrayNode messages = body.putArray("messages");
            if (systemPrompt != null && !systemPrompt.isBlank()) {
                messages.addObject().put("role", "system").put("content", systemPrompt);
            }
            messages.addObject().put("role", "user").put("content", userMessage);

            String url = settings.getBaseUrl() + "/chat/completions";
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + settings.getApiKey())
                    .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)))
                    .timeout(Duration.ofSeconds(60))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                throw new RuntimeException("OpenAI API error (" + response.statusCode() + "): " + response.body());
            }

            JsonNode json = mapper.readTree(response.body());
            return json.path("choices").path(0).path("message").path("content").asText();
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("OpenAI API call failed: " + e.getMessage(), e);
        }
    }

    private String callClaude(LlmSettings settings, String userMessage, String systemPrompt) {
        try {
            ObjectNode body = mapper.createObjectNode();
            body.put("model", settings.getModel());
            body.put("max_tokens", 4096);
            body.put("temperature", settings.getTemperature());

            if (systemPrompt != null && !systemPrompt.isBlank()) {
                body.put("system", systemPrompt);
            }

            ArrayNode messages = body.putArray("messages");
            messages.addObject().put("role", "user").put("content", userMessage);

            String url = settings.getBaseUrl() + "/messages";
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Content-Type", "application/json")
                    .header("x-api-key", settings.getApiKey())
                    .header("anthropic-version", "2023-06-01")
                    .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)))
                    .timeout(Duration.ofSeconds(60))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                throw new RuntimeException("Claude API error (" + response.statusCode() + "): " + response.body());
            }

            JsonNode json = mapper.readTree(response.body());
            return json.path("content").path(0).path("text").asText();
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("Claude API call failed: " + e.getMessage(), e);
        }
    }

    private String callOllama(LlmSettings settings, String userMessage, String systemPrompt) {
        try {
            ObjectNode body = mapper.createObjectNode();
            body.put("model", settings.getModel());
            body.put("stream", false);

            ObjectNode options = body.putObject("options");
            options.put("temperature", settings.getTemperature());

            ArrayNode messages = body.putArray("messages");
            if (systemPrompt != null && !systemPrompt.isBlank()) {
                messages.addObject().put("role", "system").put("content", systemPrompt);
            }
            messages.addObject().put("role", "user").put("content", userMessage);

            String url = settings.getBaseUrl() + "/api/chat";
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)))
                    .timeout(Duration.ofSeconds(120))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                throw new RuntimeException("Ollama API error (" + response.statusCode() + "): " + response.body());
            }

            JsonNode json = mapper.readTree(response.body());
            return json.path("message").path("content").asText();
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("Ollama API call failed: " + e.getMessage(), e);
        }
    }
}
