package com.dbee.service;

import com.dbee.config.SshTunnelConfig;
import com.dbee.db.ConnectionManager;
import com.dbee.model.SshTunnelInfo;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class SshTunnelService {
    private final SshTunnelConfig tunnelConfig;
    private final ConnectionManager connectionManager;
    private final List<SshTunnelInfo> tunnels;

    public SshTunnelService(SshTunnelConfig tunnelConfig, ConnectionManager connectionManager) {
        this.tunnelConfig = tunnelConfig;
        this.connectionManager = connectionManager;
        this.tunnels = new ArrayList<>(tunnelConfig.load());

        // Register resolver so ConnectionManager can look up tunnels by ID
        connectionManager.setTunnelResolver(this::getTunnel);
    }

    public List<SshTunnelInfo> listTunnels() {
        return List.copyOf(tunnels);
    }

    public SshTunnelInfo getTunnel(String id) {
        return tunnels.stream()
                .filter(t -> t.getId().equals(id))
                .findFirst()
                .orElse(null);
    }

    public SshTunnelInfo addTunnel(SshTunnelInfo info) {
        tunnels.add(info);
        tunnelConfig.save(tunnels);
        return info;
    }

    public SshTunnelInfo updateTunnel(String id, SshTunnelInfo info) {
        for (int i = 0; i < tunnels.size(); i++) {
            if (tunnels.get(i).getId().equals(id)) {
                info.setId(id);
                // Close existing session if active so it reconnects with new config
                connectionManager.getSshTunnelManager().closeTunnel(id);
                tunnels.set(i, info);
                tunnelConfig.save(tunnels);
                return info;
            }
        }
        throw new IllegalArgumentException("SSH tunnel not found: " + id);
    }

    public void deleteTunnel(String id) {
        connectionManager.getSshTunnelManager().closeTunnel(id);
        tunnels.removeIf(t -> t.getId().equals(id));
        tunnelConfig.save(tunnels);
    }

    public boolean isTunnelActive(String id) {
        return connectionManager.getSshTunnelManager().isTunnelActive(id);
    }

    public boolean testTunnel(SshTunnelInfo info) {
        return connectionManager.getSshTunnelManager().testConnection(info);
    }
}
