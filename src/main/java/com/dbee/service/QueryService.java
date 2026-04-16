package com.dbee.service;

import com.dbee.db.ConnectionManager;
import com.dbee.db.DatabaseDialect;
import com.dbee.db.DialectFactory;
import com.dbee.db.QueryExecutor;
import com.dbee.model.ConnectionInfo;
import com.dbee.model.DatabaseType;
import com.dbee.model.QueryHistory;
import com.dbee.model.QueryResult;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.Map;
import java.util.StringJoiner;

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
        return execute(connectionId, sql, maxRows, null);
    }

    public QueryResult execute(String connectionId, String sql, int maxRows, String executionId) {
        ConnectionInfo info = connectionService.getConnection(connectionId);
        DataSource ds = connectionManager.getOrCreate(info);
        QueryResult result = queryExecutor.execute(ds, sql, maxRows, executionId);

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

    public boolean cancelQuery(String executionId) {
        return queryExecutor.cancel(executionId);
    }

    public QueryResult explain(String connectionId, String sql, boolean analyze) {
        ConnectionInfo info = connectionService.getConnection(connectionId);
        DataSource ds = connectionManager.getOrCreate(info);
        DatabaseDialect dialect = DialectFactory.getDialect(info.getDatabaseType());

        if (analyze && !dialect.supportsExplainAnalyze()) {
            return QueryResult.ofError(
                    info.getDatabaseType().name() + " does not support EXPLAIN ANALYZE",
                    0);
        }

        // Special handling for Oracle and MSSQL
        if (info.getDatabaseType() == DatabaseType.ORACLE) {
            String explainSql = dialect.getExplainQuery(sql);
            return queryExecutor.executeOracleExplain(ds, explainSql, sql);
        }

        if (info.getDatabaseType() == DatabaseType.MSSQL) {
            return queryExecutor.executeMssqlExplain(ds, sql);
        }

        // Standard EXPLAIN for other databases
        String explainSql = analyze
                ? dialect.getExplainAnalyzeQuery(sql)
                : dialect.getExplainQuery(sql);

        if (explainSql == null) {
            return QueryResult.ofError(
                    info.getDatabaseType().name() + " does not support this EXPLAIN type",
                    0);
        }

        return queryExecutor.execute(ds, explainSql, 10000);
    }

    public QueryResult updateCell(String connectionId, String schema, String table,
                                   Map<String, Object> primaryKeys, String column, Object value) {
        if (primaryKeys == null || primaryKeys.isEmpty()) {
            return QueryResult.ofError("No primary key provided for update", 0);
        }

        ConnectionInfo info = connectionService.getConnection(connectionId);
        DataSource ds = connectionManager.getOrCreate(info);

        // Build UPDATE sql: UPDATE schema.table SET column = ? WHERE pk1 = ? AND pk2 = ?
        String qualifiedTable = (schema != null && !schema.isEmpty())
                ? quoteIdentifier(schema) + "." + quoteIdentifier(table)
                : quoteIdentifier(table);

        StringJoiner whereJoiner = new StringJoiner(" AND ");
        for (String pkCol : primaryKeys.keySet()) {
            whereJoiner.add(quoteIdentifier(pkCol) + " = ?");
        }

        String sql = "UPDATE " + qualifiedTable + " SET " + quoteIdentifier(column) + " = ? WHERE " + whereJoiner;

        long start = System.currentTimeMillis();
        try (Connection conn = ds.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {

            // Set the new value
            if (value == null || "null".equalsIgnoreCase(String.valueOf(value))) {
                ps.setObject(1, null);
            } else {
                ps.setObject(1, value);
            }

            // Set PK values
            int idx = 2;
            for (Object pkVal : primaryKeys.values()) {
                ps.setObject(idx++, pkVal);
            }

            int affected = ps.executeUpdate();
            long elapsed = System.currentTimeMillis() - start;
            return QueryResult.ofUpdate(affected, elapsed);
        } catch (SQLException e) {
            long elapsed = System.currentTimeMillis() - start;
            return QueryResult.ofError(e.getMessage(), elapsed);
        }
    }

    private String quoteIdentifier(String name) {
        return "`" + name.replace("`", "``") + "`";
    }
}
