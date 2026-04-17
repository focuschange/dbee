package com.dbee.controller;

import com.dbee.config.SnippetConfig;
import com.dbee.model.SnippetInfo;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/snippets")
public class SnippetController {
    private final SnippetConfig config;

    public SnippetController(SnippetConfig config) {
        this.config = config;
    }

    @GetMapping
    public List<SnippetInfo> list() { return config.load(); }

    @PostMapping
    public SnippetInfo create(@RequestBody SnippetInfo snippet) {
        List<SnippetInfo> list = config.load();
        snippet.setId(java.util.UUID.randomUUID().toString());
        snippet.setCreatedAt(System.currentTimeMillis());
        list.add(snippet);
        config.save(list);
        return snippet;
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable String id) {
        List<SnippetInfo> list = config.load();
        list.removeIf(s -> s.getId().equals(id));
        config.save(list);
    }
}
