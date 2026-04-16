package com.dbee.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

@RestController
@RequestMapping("/api/version")
public class VersionController {

    @Value("${app.version:1.0.0-SNAPSHOT}")
    private String currentVersion;

    private static final String GITHUB_API = "https://api.github.com/repos/focuschange/dbee/releases/latest";

    @GetMapping
    public Map<String, Object> getVersion() {
        return Map.of("version", currentVersion);
    }

    @GetMapping("/check-update")
    public Map<String, Object> checkUpdate() {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(GITHUB_API))
                    .header("Accept", "application/vnd.github.v3+json")
                    .timeout(Duration.ofSeconds(5))
                    .GET().build();

            HttpResponse<String> response = HttpClient.newHttpClient()
                    .send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 200) {
                var json = new com.fasterxml.jackson.databind.ObjectMapper().readTree(response.body());
                String latestVersion = json.path("tag_name").asText("").replaceFirst("^v", "");
                String downloadUrl = json.path("html_url").asText("");
                boolean updateAvailable = !latestVersion.isEmpty() && !latestVersion.equals(currentVersion);

                return Map.of(
                        "currentVersion", currentVersion,
                        "latestVersion", latestVersion,
                        "updateAvailable", updateAvailable,
                        "downloadUrl", downloadUrl
                );
            }
        } catch (Exception e) {
            // Silently fail — update check is best-effort
        }
        return Map.of("currentVersion", currentVersion, "updateAvailable", false);
    }
}
