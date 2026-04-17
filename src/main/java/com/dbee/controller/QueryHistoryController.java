package com.dbee.controller;

import com.dbee.model.QueryHistory;
import com.dbee.service.QueryHistoryService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/history")
public class QueryHistoryController {
    private final QueryHistoryService historyService;

    public QueryHistoryController(QueryHistoryService historyService) {
        this.historyService = historyService;
    }

    @GetMapping
    public List<QueryHistory> list(
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "100") int limit) {
        return historyService.listHistory(search, limit);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        historyService.deleteHistory(id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping
    public ResponseEntity<Void> clear() {
        historyService.clearHistory();
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/stats")
    public Map<String, Object> stats() {
        List<QueryHistory> recent = historyService.listHistory(null, 500);
        if (recent.isEmpty()) {
            return Map.of("totalQueries", 0);
        }

        long totalQueries = recent.size();
        long errorCount = recent.stream().filter(QueryHistory::isError).count();
        double avgTime = recent.stream().mapToLong(QueryHistory::getExecutionTimeMs).average().orElse(0);
        long maxTime = recent.stream().mapToLong(QueryHistory::getExecutionTimeMs).max().orElse(0);

        // Top 5 slowest queries
        List<Map<String, Object>> slowest = recent.stream()
                .filter(h -> !h.isError())
                .sorted(Comparator.comparingLong(QueryHistory::getExecutionTimeMs).reversed())
                .limit(5)
                .map(h -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("sql", h.getSql().length() > 100 ? h.getSql().substring(0, 100) + "..." : h.getSql());
                    m.put("executionTimeMs", h.getExecutionTimeMs());
                    m.put("executedAt", h.getExecutedAt());
                    m.put("connectionName", h.getConnectionName());
                    return m;
                })
                .toList();

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalQueries", totalQueries);
        stats.put("errorCount", errorCount);
        stats.put("errorRate", Math.round(errorCount * 100.0 / totalQueries));
        stats.put("avgTimeMs", Math.round(avgTime));
        stats.put("maxTimeMs", maxTime);
        stats.put("slowestQueries", slowest);
        return stats;
    }
}
