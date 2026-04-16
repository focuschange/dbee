package com.dbee.controller;

import com.dbee.model.QueryHistory;
import com.dbee.service.QueryHistoryService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

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
}
