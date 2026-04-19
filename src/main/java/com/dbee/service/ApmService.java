package com.dbee.service;

import com.dbee.db.ConnectionManager;
import com.dbee.db.apm.ApmQueries;
import com.dbee.db.apm.ApmQueriesRegistry;
import com.dbee.db.apm.ServerSession;
import com.dbee.model.ConnectionInfo;
import com.dbee.model.DatabaseType;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.util.Collections;
import java.util.List;

/**
 * #139 Phase C — thin facade over {@link ApmQueriesRegistry}. Resolves the
 * connection to its JDBC DataSource and delegates to the dialect-specific
 * implementation. ElasticSearch and other non-JDBC connections return empty
 * unsupported results.
 */
@Service
public class ApmService {
    private final ConnectionService connectionService;
    private final ConnectionManager connectionManager;

    public ApmService(ConnectionService connectionService, ConnectionManager connectionManager) {
        this.connectionService = connectionService;
        this.connectionManager = connectionManager;
    }

    public ApmQueries forConnection(String connectionId) {
        ConnectionInfo info = connectionService.getConnection(connectionId);
        DatabaseType type = info.getDatabaseType();
        return ApmQueriesRegistry.forType(type);
    }

    public List<ServerSession> listSessions(String connectionId, int limit) throws Exception {
        ConnectionInfo info = connectionService.getConnection(connectionId);
        if (info.getDatabaseType() == DatabaseType.ELASTICSEARCH) return Collections.emptyList();
        ApmQueries q = ApmQueriesRegistry.forType(info.getDatabaseType());
        if (!q.isSupported()) return Collections.emptyList();
        DataSource ds = connectionManager.getOrCreate(info);
        return q.listSessions(ds, limit);
    }

    public void killSession(String connectionId, String sessionId) throws Exception {
        ConnectionInfo info = connectionService.getConnection(connectionId);
        ApmQueries q = ApmQueriesRegistry.forType(info.getDatabaseType());
        if (!q.isSupported()) {
            throw new UnsupportedOperationException("Kill is not supported on this database yet");
        }
        DataSource ds = connectionManager.getOrCreate(info);
        q.killSession(ds, sessionId);
    }
}
