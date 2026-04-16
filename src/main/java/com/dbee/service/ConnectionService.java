package com.dbee.service;

import com.dbee.config.ConnectionConfig;
import com.dbee.db.ConnectionManager;
import com.dbee.model.ConnectionInfo;
import com.dbee.model.SshTunnelInfo;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class ConnectionService {
    private final ConnectionManager connectionManager;
    private final ConnectionConfig connectionConfig;
    private final SshTunnelService sshTunnelService;
    private final List<ConnectionInfo> connections;

    public ConnectionService(ConnectionManager connectionManager, ConnectionConfig connectionConfig,
                             SshTunnelService sshTunnelService) {
        this.connectionManager = connectionManager;
        this.connectionConfig = connectionConfig;
        this.sshTunnelService = sshTunnelService;
        this.connections = new ArrayList<>(connectionConfig.load());
    }

    public List<ConnectionInfo> listConnections() {
        return List.copyOf(connections);
    }

    public ConnectionInfo getConnection(String id) {
        return connections.stream()
                .filter(c -> c.getId().equals(id))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Connection not found: " + id));
    }

    public ConnectionInfo addConnection(ConnectionInfo info) {
        connections.add(info);
        connectionConfig.save(connections);
        return info;
    }

    public ConnectionInfo updateConnection(String id, ConnectionInfo info) {
        for (int i = 0; i < connections.size(); i++) {
            if (connections.get(i).getId().equals(id)) {
                info.setId(id);
                connections.set(i, info);
                connectionConfig.save(connections);
                return info;
            }
        }
        throw new IllegalArgumentException("Connection not found: " + id);
    }

    public void deleteConnection(String id) {
        connectionManager.close(id);
        connections.removeIf(c -> c.getId().equals(id));
        connectionConfig.save(connections);
    }

    public boolean testConnection(ConnectionInfo info) {
        String tunnelId = info.getProperties().get("sshTunnelId");
        SshTunnelInfo tunnel = null;
        if (tunnelId != null && !tunnelId.isBlank()) {
            tunnel = sshTunnelService.getTunnel(tunnelId);
        }
        return connectionManager.testConnection(info, tunnel);
    }

    public void connect(String id) {
        ConnectionInfo info = getConnection(id);
        connectionManager.getOrCreate(info);
    }

    public void disconnect(String id) {
        connectionManager.close(id);
    }

    public boolean isConnected(String id) {
        return connectionManager.isConnected(id);
    }

    public boolean isSshTunnelActive(String connectionId) {
        ConnectionInfo info = getConnection(connectionId);
        String tunnelId = info.getProperties().get("sshTunnelId");
        if (tunnelId == null || tunnelId.isBlank()) return false;
        return connectionManager.getSshTunnelManager().isTunnelActive(tunnelId);
    }
}
