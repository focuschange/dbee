package com.dbee.controller;

import com.dbee.service.MetadataService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Base64;
import java.util.Map;

/**
 * Confluence and Jira integration endpoints.
 */
@RestController
@RequestMapping("/api/integration")
public class IntegrationController {
    private static final Logger log = LoggerFactory.getLogger(IntegrationController.class);
    private final MetadataService metadataService;
    private final HttpClient httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final ObjectMapper mapper = new ObjectMapper();

    public IntegrationController(MetadataService metadataService) {
        this.metadataService = metadataService;
    }

    /**
     * Publish schema documentation to a Confluence page.
     */
    @PostMapping("/confluence/publish")
    public Map<String, Object> publishToConfluence(@RequestBody Map<String, String> params) {
        try {
            String baseUrl = params.get("baseUrl"); // e.g., https://your-domain.atlassian.net/wiki
            String spaceKey = params.get("spaceKey");
            String title = params.get("title");
            String content = params.get("content"); // HTML or storage format
            String email = params.get("email");
            String apiToken = params.get("apiToken");

            String auth = Base64.getEncoder().encodeToString((email + ":" + apiToken).getBytes());

            String body = mapper.writeValueAsString(Map.of(
                    "type", "page",
                    "title", title,
                    "space", Map.of("key", spaceKey),
                    "body", Map.of("storage", Map.of("value", content, "representation", "storage"))
            ));

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(baseUrl + "/rest/api/content"))
                    .header("Authorization", "Basic " + auth)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .timeout(Duration.ofSeconds(15))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 200 || response.statusCode() == 201) {
                var json = mapper.readTree(response.body());
                String pageUrl = baseUrl + json.path("_links").path("webui").asText("");
                return Map.of("success", true, "pageUrl", pageUrl);
            } else {
                return Map.of("success", false, "message", "Confluence API error: " + response.statusCode());
            }
        } catch (Exception e) {
            log.error("Confluence publish failed: {}", e.getMessage());
            return Map.of("success", false, "message", e.getMessage());
        }
    }

    /**
     * Create a Jira issue with query results or schema info.
     */
    @PostMapping("/jira/create-issue")
    public Map<String, Object> createJiraIssue(@RequestBody Map<String, String> params) {
        try {
            String baseUrl = params.get("baseUrl"); // e.g., https://your-domain.atlassian.net
            String projectKey = params.get("projectKey");
            String summary = params.get("summary");
            String description = params.get("description");
            String issueType = params.getOrDefault("issueType", "Task");
            String email = params.get("email");
            String apiToken = params.get("apiToken");

            String auth = Base64.getEncoder().encodeToString((email + ":" + apiToken).getBytes());

            String body = mapper.writeValueAsString(Map.of(
                    "fields", Map.of(
                            "project", Map.of("key", projectKey),
                            "summary", summary,
                            "description", Map.of(
                                    "type", "doc", "version", 1,
                                    "content", java.util.List.of(Map.of(
                                            "type", "paragraph",
                                            "content", java.util.List.of(Map.of("type", "text", "text", description))
                                    ))
                            ),
                            "issuetype", Map.of("name", issueType)
                    )
            ));

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(baseUrl + "/rest/api/3/issue"))
                    .header("Authorization", "Basic " + auth)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .timeout(Duration.ofSeconds(15))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 201) {
                var json = mapper.readTree(response.body());
                String issueKey = json.path("key").asText("");
                String issueUrl = baseUrl + "/browse/" + issueKey;
                return Map.of("success", true, "issueKey", issueKey, "issueUrl", issueUrl);
            } else {
                return Map.of("success", false, "message", "Jira API error: " + response.statusCode() + " " + response.body());
            }
        } catch (Exception e) {
            log.error("Jira issue creation failed: {}", e.getMessage());
            return Map.of("success", false, "message", e.getMessage());
        }
    }
}
