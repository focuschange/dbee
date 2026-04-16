package com.dbee.controller;

import com.dbee.model.SshTunnelInfo;
import com.dbee.service.SshTunnelService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tunnels")
public class SshTunnelController {
    private final SshTunnelService tunnelService;

    public SshTunnelController(SshTunnelService tunnelService) {
        this.tunnelService = tunnelService;
    }

    @GetMapping
    public List<SshTunnelInfo> list() {
        return tunnelService.listTunnels();
    }

    @PostMapping
    public SshTunnelInfo create(@RequestBody SshTunnelInfo info) {
        return tunnelService.addTunnel(info);
    }

    @PutMapping("/{id}")
    public SshTunnelInfo update(@PathVariable String id, @RequestBody SshTunnelInfo info) {
        return tunnelService.updateTunnel(id, info);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        tunnelService.deleteTunnel(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/status")
    public Map<String, Boolean> status(@PathVariable String id) {
        return Map.of("active", tunnelService.isTunnelActive(id));
    }

    @PostMapping("/test")
    public Map<String, Object> test(@RequestBody SshTunnelInfo info) {
        boolean success = tunnelService.testTunnel(info);
        return Map.of("success", success, "message", success ? "SSH connection successful" : "SSH connection failed");
    }
}
