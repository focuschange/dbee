package com.dbee.controller;

import com.dbee.model.ErdLayout;
import com.dbee.service.ErdLayoutService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/erd/layout")
public class ErdLayoutController {
    private final ErdLayoutService layoutService;

    public ErdLayoutController(ErdLayoutService layoutService) {
        this.layoutService = layoutService;
    }

    @GetMapping("/{connectionId}/{schema}")
    public ResponseEntity<ErdLayout> get(@PathVariable String connectionId, @PathVariable String schema) {
        ErdLayout layout = layoutService.getLayout(connectionId, schema);
        if (layout == null) return ResponseEntity.noContent().build();
        return ResponseEntity.ok(layout);
    }

    @PutMapping("/{connectionId}/{schema}")
    public Map<String, Boolean> save(@PathVariable String connectionId,
                                      @PathVariable String schema,
                                      @RequestBody ErdLayout layout) {
        layoutService.saveLayout(connectionId, schema, layout);
        return Map.of("saved", true);
    }

    @DeleteMapping("/{connectionId}/{schema}")
    public ResponseEntity<Void> delete(@PathVariable String connectionId, @PathVariable String schema) {
        layoutService.deleteLayout(connectionId, schema);
        return ResponseEntity.noContent().build();
    }
}
