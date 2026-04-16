package com.dbee.service;

import com.dbee.db.ConnectionManager;
import com.dbee.db.QueryExecutor;
import com.dbee.model.ConnectionInfo;
import com.dbee.model.QueryHistory;
import com.dbee.model.QueryResult;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;

@Service
public class QueryService {
    private final ConnectionManager connectionManager;
    private final QueryExecutor queryExecutor;
    private final ConnectionService connectionService;
    private final QueryHistoryService historyService;

    public QueryService(ConnectionManager connectionManager, QueryExecutor queryExecutor,
                        ConnectionService connectionService, QueryHistoryService historyService) {
        this.connectionManager = connectionManager;
        this.queryExecutor = queryExecutor;
        this.connectionService = connectionService;
        this.historyService = historyService;
    }

    public QueryResult execute(String connectionId, String sql, int maxRows) {
        ConnectionInfo info = connectionService.getConnection(connectionId);
        DataSource ds = connectionManager.getOrCreate(info);
        QueryResult result = queryExecutor.execute(ds, sql, maxRows);

        // Record to history
        boolean isError = result.getErrorMessage() != null;
        int rowCount = result.getRows() != null ? result.getRows().size() : result.getAffectedRows();
        historyService.addHistory(new QueryHistory(
                sql, connectionId, info.getName(),
                result.getExecutionTimeMs(), rowCount,
                isError, result.getErrorMessage()
        ));

        return result;
    }
}
