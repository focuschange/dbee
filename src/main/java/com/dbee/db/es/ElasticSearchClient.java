package com.dbee.db.es;

import com.dbee.model.ColumnInfo;
import com.dbee.model.ConnectionInfo;
import com.dbee.model.QueryResult;
import com.dbee.model.SchemaInfo;
import com.dbee.model.TableInfo;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpRequest.BodyPublishers;
import java.net.http.HttpResponse;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Iterator;
import java.util.List;

public class ElasticSearchClient {
    private static final Logger log = LoggerFactory.getLogger(ElasticSearchClient.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private static final String FALLBACK_SCHEMA = "cluster";

    private final String baseUrl;
    private final String authHeader;
    private final HttpClient httpClient;
    private volatile String clusterName;

    public ElasticSearchClient(ConnectionInfo info) {
        boolean https = "true".equalsIgnoreCase(info.getProperties().getOrDefault("https", "false"));
        String scheme = https ? "https" : "http";
        String host = info.getHost() != null ? info.getHost() : "localhost";
        int port = info.getPort() > 0 ? info.getPort() : 9200;
        this.baseUrl = scheme + "://" + host + ":" + port;

        if (info.getUsername() != null && !info.getUsername().isBlank()) {
            String raw = info.getUsername() + ":" + (info.getPassword() != null ? info.getPassword() : "");
            this.authHeader = "Basic " + Base64.getEncoder().encodeToString(raw.getBytes());
        } else {
            this.authHeader = null;
        }

        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build();
    }

    public boolean ping() {
        try {
            HttpResponse<String> resp = send(newRequest("/").GET());
            if (resp.statusCode() == 200) {
                try {
                    JsonNode root = MAPPER.readTree(resp.body());
                    String name = root.path("cluster_name").asText(null);
                    if (name != null && !name.isBlank()) clusterName = name;
                } catch (Exception ignore) {
                }
                return true;
            }
            return false;
        } catch (Exception e) {
            log.warn("ES ping failed: {}", e.getMessage());
            return false;
        }
    }

    public String getSchemaName() {
        if (clusterName == null) ping();
        return clusterName != null ? clusterName : FALLBACK_SCHEMA;
    }

    public List<SchemaInfo> getSchemas() {
        return List.of(new SchemaInfo(getSchemaName(), null));
    }

    public List<TableInfo> listIndices() {
        try {
            HttpResponse<String> resp = send(newRequest("/_cat/indices?format=json&h=index").GET());
            if (resp.statusCode() != 200) return List.of();
            JsonNode arr = MAPPER.readTree(resp.body());
            List<TableInfo> out = new ArrayList<>();
            for (JsonNode n : arr) {
                String idx = n.path("index").asText();
                if (idx.isEmpty() || idx.startsWith(".")) continue;
                out.add(new TableInfo(idx, getSchemaName(), "INDEX"));
            }
            out.sort((a, b) -> a.name().compareToIgnoreCase(b.name()));
            return out;
        } catch (Exception e) {
            log.warn("ES list indices failed: {}", e.getMessage());
            return List.of();
        }
    }

    public List<ColumnInfo> getColumns(String index) {
        try {
            HttpResponse<String> resp = send(newRequest("/" + index + "/_mapping").GET());
            if (resp.statusCode() != 200) return List.of();
            JsonNode root = MAPPER.readTree(resp.body());
            Iterator<String> names = root.fieldNames();
            if (!names.hasNext()) return List.of();
            JsonNode props = root.get(names.next()).path("mappings").path("properties");
            List<ColumnInfo> out = new ArrayList<>();
            extractFields("", props, out);
            return out;
        } catch (Exception e) {
            log.warn("ES mapping failed for {}: {}", index, e.getMessage());
            return List.of();
        }
    }

    private void extractFields(String prefix, JsonNode props, List<ColumnInfo> out) {
        if (props == null || !props.isObject()) return;
        Iterator<String> names = props.fieldNames();
        while (names.hasNext()) {
            String name = names.next();
            JsonNode field = props.get(name);
            String fullName = prefix.isEmpty() ? name : prefix + "." + name;
            String type = field.path("type").asText(field.has("properties") ? "object" : "keyword");
            out.add(new ColumnInfo(fullName, type, 0, true));
            JsonNode nested = field.path("properties");
            if (nested.isObject()) extractFields(fullName, nested, out);
        }
    }

    public QueryResult executeSql(String sql, int maxRows) {
        long start = System.currentTimeMillis();
        try {
            String normalized = sql == null ? "" : sql.trim();
            while (normalized.endsWith(";")) {
                normalized = normalized.substring(0, normalized.length() - 1).trim();
            }
            ObjectNode body = MAPPER.createObjectNode();
            body.put("query", normalized);
            int fetchSize = maxRows > 0 ? Math.min(maxRows, 1000) : 1000;
            body.put("fetch_size", fetchSize);

            HttpResponse<String> resp = send(newRequest("/_sql?format=json")
                    .POST(BodyPublishers.ofString(MAPPER.writeValueAsString(body)))
                    .header("Content-Type", "application/json"));

            if (resp.statusCode() != 200) {
                return QueryResult.ofError("ES error " + resp.statusCode() + ": " + extractError(resp.body()),
                        System.currentTimeMillis() - start);
            }

            JsonNode root = MAPPER.readTree(resp.body());
            List<String> colNames = new ArrayList<>();
            List<String> colTypes = new ArrayList<>();
            List<Class<?>> colClasses = new ArrayList<>();
            for (JsonNode c : root.path("columns")) {
                colNames.add(c.path("name").asText());
                String t = c.path("type").asText();
                colTypes.add(t);
                colClasses.add(mapType(t));
            }

            List<Object[]> rows = new ArrayList<>();
            String cursor = root.path("cursor").asText(null);

            appendRows(root.path("rows"), colNames.size(), rows);

            while (cursor != null && !cursor.isEmpty() && (maxRows <= 0 || rows.size() < maxRows)) {
                ObjectNode cursorBody = MAPPER.createObjectNode();
                cursorBody.put("cursor", cursor);
                HttpResponse<String> cursorResp = send(newRequest("/_sql?format=json")
                        .POST(BodyPublishers.ofString(MAPPER.writeValueAsString(cursorBody)))
                        .header("Content-Type", "application/json"));
                if (cursorResp.statusCode() != 200) break;
                JsonNode cursorRoot = MAPPER.readTree(cursorResp.body());
                appendRows(cursorRoot.path("rows"), colNames.size(), rows);
                cursor = cursorRoot.path("cursor").asText(null);
                if (maxRows > 0 && rows.size() >= maxRows) {
                    closeCursor(cursor);
                    break;
                }
            }

            if (maxRows > 0 && rows.size() > maxRows) {
                rows = new ArrayList<>(rows.subList(0, maxRows));
            }

            return QueryResult.ofSelect(colNames, colClasses, colTypes, rows,
                    System.currentTimeMillis() - start, null, getSchemaName());
        } catch (Exception e) {
            return QueryResult.ofError(e.getMessage(), System.currentTimeMillis() - start);
        }
    }

    private void appendRows(JsonNode rowsNode, int colCount, List<Object[]> out) {
        if (!rowsNode.isArray()) return;
        for (JsonNode r : rowsNode) {
            Object[] row = new Object[colCount];
            for (int i = 0; i < colCount; i++) {
                row[i] = nodeToJava(r.get(i));
            }
            out.add(row);
        }
    }

    private void closeCursor(String cursor) {
        if (cursor == null || cursor.isEmpty()) return;
        try {
            ObjectNode body = MAPPER.createObjectNode();
            body.put("cursor", cursor);
            send(newRequest("/_sql/close")
                    .POST(BodyPublishers.ofString(MAPPER.writeValueAsString(body)))
                    .header("Content-Type", "application/json"));
        } catch (Exception ignore) {
        }
    }

    private String extractError(String body) {
        try {
            JsonNode root = MAPPER.readTree(body);
            JsonNode err = root.path("error");
            String reason = err.path("reason").asText(null);
            if (reason != null) return reason;
        } catch (Exception ignore) {
        }
        return body;
    }

    private HttpRequest.Builder newRequest(String path) {
        HttpRequest.Builder b = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + path))
                .timeout(Duration.ofSeconds(30));
        if (authHeader != null) {
            b.header("Authorization", authHeader);
        }
        return b;
    }

    private HttpResponse<String> send(HttpRequest.Builder b) throws Exception {
        return httpClient.send(b.build(), HttpResponse.BodyHandlers.ofString());
    }

    private Class<?> mapType(String esType) {
        if (esType == null) return String.class;
        return switch (esType.toLowerCase()) {
            case "long", "integer", "short", "byte" -> Long.class;
            case "float", "double", "half_float", "scaled_float" -> Double.class;
            case "boolean" -> Boolean.class;
            case "date", "datetime" -> Timestamp.class;
            default -> String.class;
        };
    }

    private Object nodeToJava(JsonNode v) {
        if (v == null || v.isNull() || v.isMissingNode()) return null;
        if (v.isBoolean()) return v.booleanValue();
        if (v.isInt() || v.isLong()) return v.longValue();
        if (v.isFloat() || v.isDouble()) return v.doubleValue();
        if (v.isArray() || v.isObject()) return v.toString();
        String s = v.asText();
        if (looksLikeIsoDate(s)) {
            try {
                return Timestamp.from(Instant.parse(s));
            } catch (Exception ignore) {
            }
        }
        return s;
    }

    private boolean looksLikeIsoDate(String s) {
        return s != null && s.length() >= 20 && s.charAt(4) == '-' && s.charAt(7) == '-' && s.charAt(10) == 'T';
    }
}
