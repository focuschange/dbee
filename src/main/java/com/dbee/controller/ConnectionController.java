package com.dbee.controller;

import com.dbee.model.ConnectionInfo;
import com.dbee.service.ConnectionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/connections")
public class ConnectionController {
    private final ConnectionService connectionService;

    public ConnectionController(ConnectionService connectionService) {
        this.connectionService = connectionService;
    }

    @GetMapping
    public List<ConnectionInfo> list() {
        return connectionService.listConnections();
    }

    @PostMapping
    public ConnectionInfo create(@RequestBody ConnectionInfo info) {
        return connectionService.addConnection(info);
    }

    @PutMapping("/{id}")
    public ConnectionInfo update(@PathVariable String id, @RequestBody ConnectionInfo info) {
        return connectionService.updateConnection(id, info);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        connectionService.deleteConnection(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Returns connection IDs that need password re-entry (encryption key changed).
     */
    @GetMapping("/password-reentry-required")
    public Map<String, Object> passwordReentryRequired() {
        Set<String> ids = connectionService.getPasswordReentryRequired();
        return Map.of("connectionIds", ids, "required", !ids.isEmpty());
    }

    @PostMapping("/test")
    public Map<String, Object> test(@RequestBody ConnectionInfo info) {
        boolean success = connectionService.testConnection(info);
        return Map.of("success", success, "message", success ? "Connection successful" : "Connection failed");
    }

    @PostMapping("/{id}/connect")
    public Map<String, Boolean> connect(@PathVariable String id) {
        connectionService.connect(id);
        return Map.of("connected", true);
    }

    @PostMapping("/{id}/disconnect")
    public ResponseEntity<Void> disconnect(@PathVariable String id) {
        connectionService.disconnect(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/status")
    public Map<String, Object> status(@PathVariable String id) {
        return Map.of(
                "connected", connectionService.isConnected(id),
                "sshTunnel", connectionService.isSshTunnelActive(id)
        );
    }

    // #138 — Sessions tab Pool Stats
    @GetMapping("/pool-stats")
    public List<Map<String, Object>> poolStats() {
        return connectionService.getPoolStats();
    }
}
