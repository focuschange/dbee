package com.dbee.controller;

import com.dbee.model.QueryResult;
import com.dbee.service.QueryService;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.*;

@RestController
@RequestMapping("/api/import")
public class ImportController {
    private final QueryService queryService;

    public ImportController(QueryService queryService) {
        this.queryService = queryService;
    }

    @PostMapping("/sql")
    public Map<String, Object> importSql(@RequestParam String connectionId,
                                          @RequestParam MultipartFile file) throws Exception {
        String sql = new String(file.getBytes(), StandardCharsets.UTF_8);
        // Split and execute each statement
        String[] statements = sql.split(";");
        int success = 0, errors = 0;
        List<String> errorMessages = new ArrayList<>();

        for (String stmt : statements) {
            String trimmed = stmt.trim();
            if (trimmed.isEmpty()) continue;
            QueryResult result = queryService.execute(connectionId, trimmed, 1);
            if (result.isError()) {
                errors++;
                errorMessages.add(result.getErrorMessage());
            } else {
                success++;
            }
        }

        return Map.of(
                "success", errors == 0,
                "executed", success,
                "errors", errors,
                "errorMessages", errorMessages.size() > 5 ? errorMessages.subList(0, 5) : errorMessages
        );
    }

    @PostMapping("/csv")
    public Map<String, Object> importCsv(@RequestParam String connectionId,
                                          @RequestParam String table,
                                          @RequestParam MultipartFile file) throws Exception {
        BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8));
        String headerLine = reader.readLine();
        if (headerLine == null) return Map.of("success", false, "message", "Empty file");

        String[] columns = headerLine.split(",");
        String colList = String.join(", ", Arrays.stream(columns).map(c -> "`" + c.trim() + "`").toList());
        String placeholders = String.join(", ", Arrays.stream(columns).map(c -> "?").toList());

        // Validate table name: only allow alphanumeric + underscore
        if (!table.matches("[a-zA-Z_][a-zA-Z0-9_]*")) {
            return Map.of("success", false, "message", "Invalid table name");
        }

        int inserted = 0;
        String line;
        List<String> errors = new ArrayList<>();

        // Use parameterized INSERT via QueryService.insertRow
        while ((line = reader.readLine()) != null) {
            if (line.trim().isEmpty()) continue;
            String[] values = parseCsvLine(line);
            Map<String, Object> rowValues = new java.util.LinkedHashMap<>();
            for (int i = 0; i < Math.min(columns.length, values.length); i++) {
                String v = values[i].trim();
                rowValues.put(columns[i].trim(), v.isEmpty() || v.equalsIgnoreCase("null") ? null : v);
            }
            // Use insertRow which uses PreparedStatement with parameter binding
            QueryResult result = queryService.insertRow(connectionId, null, table, rowValues);
            if (result.isError()) {
                errors.add(result.getErrorMessage());
            } else {
                inserted++;
            }
        }

        return Map.of("success", errors.isEmpty(), "inserted", inserted, "errors", errors.size());
    }

    private String[] parseCsvLine(String line) {
        List<String> fields = new ArrayList<>();
        boolean inQuotes = false;
        StringBuilder current = new StringBuilder();
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (c == '"') {
                if (inQuotes && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    current.append('"');
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (c == ',' && !inQuotes) {
                fields.add(current.toString());
                current.setLength(0);
            } else {
                current.append(c);
            }
        }
        fields.add(current.toString());
        return fields.toArray(new String[0]);
    }
}
