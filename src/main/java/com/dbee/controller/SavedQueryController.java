package com.dbee.controller;

import com.dbee.config.SavedQueryConfig;
import com.dbee.model.SavedQueryInfo;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/saved-queries")
public class SavedQueryController {
    private final SavedQueryConfig config;

    public SavedQueryController(SavedQueryConfig config) {
        this.config = config;
    }

    @GetMapping
    public List<SavedQueryInfo> list() {
        return config.load();
    }

    @PostMapping
    public SavedQueryInfo create(@RequestBody SavedQueryInfo query) {
        List<SavedQueryInfo> queries = config.load();
        query.setId(java.util.UUID.randomUUID().toString());
        query.setCreatedAt(System.currentTimeMillis());
        query.setUpdatedAt(System.currentTimeMillis());
        queries.add(query);
        config.save(queries);
        return query;
    }

    @PutMapping("/{id}")
    public SavedQueryInfo update(@PathVariable String id, @RequestBody SavedQueryInfo updated) {
        List<SavedQueryInfo> queries = config.load();
        for (int i = 0; i < queries.size(); i++) {
            if (queries.get(i).getId().equals(id)) {
                updated.setId(id);
                updated.setCreatedAt(queries.get(i).getCreatedAt());
                updated.setUpdatedAt(System.currentTimeMillis());
                queries.set(i, updated);
                config.save(queries);
                return updated;
            }
        }
        throw new RuntimeException("Saved query not found: " + id);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable String id) {
        List<SavedQueryInfo> queries = config.load();
        queries.removeIf(q -> q.getId().equals(id));
        config.save(queries);
    }
}
