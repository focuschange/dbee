package com.dbee.db;

import com.dbee.db.es.ElasticSearchClient;
import com.dbee.model.ConnectionInfo;
import com.dbee.model.DatabaseType;
import com.dbee.model.SshTunnelInfo;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.sql.DataSource;
import java.sql.Connection;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;

public class ConnectionManager {
    private static final Logger log = LoggerFactory.getLogger(ConnectionManager.class);
    private final Map<String, HikariDataSource> pools = new ConcurrentHashMap<>();
    private final Map<String, ElasticSearchClient> esClients = new ConcurrentHashMap<>();
    private final SshTunnelManager sshTunnelManager = new SshTunnelManager();

    // Callback to resolve tunnelId -> SshTunnelInfo
    private Function<String, SshTunnelInfo> tunnelResolver;

    public void setTunnelResolver(Function<String, SshTunnelInfo> resolver) {
        this.tunnelResolver = resolver;
    }

    public DataSource getOrCreate(ConnectionInfo info) {
        if (info.getDatabaseType() == DatabaseType.ELASTICSEARCH) {
            throw new UnsupportedOperationException(
                    "ElasticSearch connections use REST API, not JDBC. Call getElasticSearchClient() instead.");
        }
        return pools.computeIfAbsent(info.getId(), id -> createPool(info));
    }

    public ElasticSearchClient getElasticSearchClient(ConnectionInfo info) {
        return esClients.computeIfAbsent(info.getId(), id -> {
            log.info("Creating ElasticSearch client: {}", info.getName());
            return new ElasticSearchClient(info);
        });
    }

    public boolean testConnection(ConnectionInfo info, SshTunnelInfo tunnel) {
        if (info.getDatabaseType() == DatabaseType.ELASTICSEARCH) {
            ElasticSearchClient client = new ElasticSearchClient(info);
            boolean ok = client.ping();
            if (ok) log.info("ES connection test successful: {}", info.getName());
            else log.error("ES connection test failed: {}", info.getName());
            return ok;
        }

        SshTunnelManager.TestTunnel testTunnel = null;
        try {
            if (tunnel != null) {
                String remoteHost = info.getHost();
                int remotePort = info.getPort() > 0 ? info.getPort() : info.getDatabaseType().getDefaultPort();
                testTunnel = sshTunnelManager.createTestForward(tunnel, remoteHost, remotePort);
            }

            HikariConfig config = buildConfig(info, testTunnel != null ? testTunnel.localPort() : -1);
            config.setMaximumPoolSize(1);
            config.setConnectionTimeout(5000);
            try (HikariDataSource ds = new HikariDataSource(config);
                 Connection conn = ds.getConnection()) {
                DatabaseDialect dialect = DialectFactory.getDialect(info.getDatabaseType());
                conn.createStatement().execute(dialect.getValidationQuery());
                log.info("Connection test successful: {}", info.getName());
                return true;
            }
        } catch (Exception e) {
            log.error("Connection test failed: {}", info.getName(), e);
            return false;
        } finally {
            if (testTunnel != null) testTunnel.close();
        }
    }

    public void close(String connectionId) {
        HikariDataSource ds = pools.remove(connectionId);
        if (ds != null && !ds.isClosed()) {
            ds.close();
            log.info("Connection pool closed: {}", connectionId);
        }
        if (esClients.remove(connectionId) != null) {
            log.info("ES client closed: {}", connectionId);
        }
    }

    public void closeAll() {
        pools.forEach((id, ds) -> {
            if (!ds.isClosed()) ds.close();
        });
        pools.clear();
        esClients.clear();
        sshTunnelManager.closeAll();
        log.info("All connection pools and SSH tunnels closed");
    }

    public boolean isConnected(String connectionId) {
        ElasticSearchClient esClient = esClients.get(connectionId);
        if (esClient != null) return esClient.ping();

        HikariDataSource ds = pools.get(connectionId);
        if (ds == null || ds.isClosed()) return false;
        try (Connection conn = ds.getConnection()) {
            return conn.isValid(2);
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Reconnect a broken connection by closing and recreating the pool.
     */
    public DataSource reconnect(ConnectionInfo info) {
        close(info.getId());
        log.info("Reconnecting: {}", info.getName());
        return getOrCreate(info);
    }

    public SshTunnelManager getSshTunnelManager() {
        return sshTunnelManager;
    }

    private HikariDataSource createPool(ConnectionInfo info) {
        int localPort = -1;
        String tunnelId = info.getProperties().get("sshTunnelId");
        if (tunnelId != null && !tunnelId.isBlank() && tunnelResolver != null) {
            SshTunnelInfo tunnel = tunnelResolver.apply(tunnelId);
            if (tunnel != null) {
                String remoteHost = info.getHost();
                int remotePort = info.getPort() > 0 ? info.getPort() : info.getDatabaseType().getDefaultPort();
                SshTunnelManager.ForwardResult fwd = sshTunnelManager.getOrCreateForward(tunnel, remoteHost, remotePort);
                localPort = fwd.localPort();
            }
        }

        HikariConfig config = buildConfig(info, localPort);
        log.info("Creating connection pool: {}", info.getName());
        return new HikariDataSource(config);
    }

    private HikariConfig buildConfig(ConnectionInfo info, int tunnelLocalPort) {
        HikariConfig config = new HikariConfig();

        if (tunnelLocalPort > 0) {
            ConnectionInfo tunneled = new ConnectionInfo();
            tunneled.setDatabaseType(info.getDatabaseType());
            tunneled.setHost("127.0.0.1");
            tunneled.setPort(tunnelLocalPort);
            tunneled.setDatabase(info.getDatabase());
            tunneled.setProperties(info.getProperties());
            config.setJdbcUrl(tunneled.getDatabaseType().buildJdbcUrl(tunneled));
        } else {
            config.setJdbcUrl(info.getDatabaseType().buildJdbcUrl(info));
        }

        config.setUsername(info.getUsername());
        config.setPassword(info.getPassword());
        config.setMaximumPoolSize(5);
        config.setMinimumIdle(1);
        config.setConnectionTimeout(10000);
        config.setIdleTimeout(300000);

        DatabaseDialect dialect = DialectFactory.getDialect(info.getDatabaseType());
        config.setConnectionTestQuery(dialect.getValidationQuery());

        try {
            Class.forName(info.getDatabaseType().getDriverClass());
        } catch (ClassNotFoundException e) {
            log.warn("JDBC driver not found: {}", info.getDatabaseType().getDriverClass());
        }

        return config;
    }
}
