package com.dbee.db;

import com.dbee.model.SshTunnelInfo;
import com.jcraft.jsch.JSch;
import com.jcraft.jsch.Session;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class SshTunnelManager {
    private static final Logger log = LoggerFactory.getLogger(SshTunnelManager.class);

    // tunnelId -> active session
    private final Map<String, Session> sessions = new ConcurrentHashMap<>();
    // tunnelId:remoteHost:remotePort -> local forwarded port
    private final Map<String, Integer> forwardedPorts = new ConcurrentHashMap<>();

    public record ForwardResult(int localPort) {}

    /**
     * Get or create an SSH session and set up port forwarding for the given remote target.
     * Multiple connections sharing the same tunnel but targeting different hosts/ports
     * each get their own forwarding rule on the same SSH session.
     */
    public ForwardResult getOrCreateForward(SshTunnelInfo tunnel, String remoteHost, int remotePort) {
        String forwardKey = tunnel.getId() + ":" + remoteHost + ":" + remotePort;
        Integer existing = forwardedPorts.get(forwardKey);
        if (existing != null) {
            Session session = sessions.get(tunnel.getId());
            if (session != null && session.isConnected()) {
                return new ForwardResult(existing);
            }
            // Session died, clean up
            forwardedPorts.remove(forwardKey);
            sessions.remove(tunnel.getId());
        }
        return createForward(tunnel, remoteHost, remotePort, forwardKey);
    }

    /**
     * Create a temporary tunnel for testing, not stored in the pool.
     */
    public TestTunnel createTestForward(SshTunnelInfo tunnel, String remoteHost, int remotePort) {
        try {
            Session session = createSession(tunnel);
            session.connect();
            int localPort = session.setPortForwardingL(0, remoteHost, remotePort);
            log.info("Test SSH tunnel: localhost:{} -> {}:{} via {}@{}:{}",
                    localPort, remoteHost, remotePort, tunnel.getUsername(), tunnel.getHost(), tunnel.getPort());
            return new TestTunnel(session, localPort);
        } catch (Exception e) {
            throw new RuntimeException("SSH tunnel failed: " + e.getMessage(), e);
        }
    }

    public record TestTunnel(Session session, int localPort) {
        public void close() {
            if (session.isConnected()) session.disconnect();
        }
    }

    public void closeTunnel(String tunnelId) {
        Session session = sessions.remove(tunnelId);
        if (session != null && session.isConnected()) {
            session.disconnect();
            log.info("SSH tunnel closed: {}", tunnelId);
        }
        forwardedPorts.entrySet().removeIf(e -> e.getKey().startsWith(tunnelId + ":"));
    }

    public boolean testConnection(SshTunnelInfo tunnel) {
        try {
            Session session = createSession(tunnel);
            session.connect();
            boolean connected = session.isConnected();
            session.disconnect();
            log.info("SSH test {}: {}@{}:{}", connected ? "successful" : "failed",
                    tunnel.getUsername(), tunnel.getHost(), tunnel.getPort());
            return connected;
        } catch (Exception e) {
            log.error("SSH test failed: {}@{}:{} - {}", tunnel.getUsername(), tunnel.getHost(), tunnel.getPort(), e.getMessage());
            return false;
        }
    }

    public void closeAll() {
        sessions.forEach((id, session) -> {
            if (session.isConnected()) session.disconnect();
        });
        sessions.clear();
        forwardedPorts.clear();
        log.info("All SSH tunnels closed");
    }

    public boolean isTunnelActive(String tunnelId) {
        Session session = sessions.get(tunnelId);
        return session != null && session.isConnected();
    }

    private ForwardResult createForward(SshTunnelInfo tunnel, String remoteHost, int remotePort, String forwardKey) {
        try {
            Session session = sessions.computeIfAbsent(tunnel.getId(), id -> {
                try {
                    Session s = createSession(tunnel);
                    s.connect();
                    log.info("SSH session established: {}@{}:{}", tunnel.getUsername(), tunnel.getHost(), tunnel.getPort());
                    return s;
                } catch (Exception e) {
                    throw new RuntimeException("SSH connection failed: " + e.getMessage(), e);
                }
            });

            int localPort = session.setPortForwardingL(0, remoteHost, remotePort);
            forwardedPorts.put(forwardKey, localPort);
            log.info("SSH port forward: localhost:{} -> {}:{} via tunnel '{}'",
                    localPort, remoteHost, remotePort, tunnel.getName());
            return new ForwardResult(localPort);
        } catch (Exception e) {
            throw new RuntimeException("SSH tunnel failed: " + e.getMessage(), e);
        }
    }

    private Session createSession(SshTunnelInfo tunnel) throws Exception {
        JSch jsch = new JSch();

        if ("key".equals(tunnel.getAuthType()) && tunnel.getKeyPath() != null && !tunnel.getKeyPath().isBlank()) {
            String keyPath = tunnel.getKeyPath().replaceFirst("^~", System.getProperty("user.home"));
            if (tunnel.getKeyPassphrase() != null && !tunnel.getKeyPassphrase().isBlank()) {
                jsch.addIdentity(keyPath, tunnel.getKeyPassphrase());
            } else {
                jsch.addIdentity(keyPath);
            }
        }

        Session session = jsch.getSession(tunnel.getUsername(), tunnel.getHost(), tunnel.getPort());

        if ("password".equals(tunnel.getAuthType())) {
            session.setPassword(tunnel.getPassword());
        }

        session.setConfig("StrictHostKeyChecking", "no");
        session.setConfig("ServerAliveInterval", "30");
        session.setConfig("ServerAliveCountMax", "3");
        session.setTimeout(10000);
        return session;
    }
}
