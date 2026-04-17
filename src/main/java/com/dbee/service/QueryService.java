package com.dbee.service;

import com.dbee.config.AuditLogConfig;
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
    private final AuditLogConfig auditLog;

    public QueryService(ConnectionManager connectionManager, QueryExecutor queryExecutor,
                        ConnectionService connectionService, QueryHistoryService historyService,
                        AuditLogConfig auditLog) {
        this.connectionManager = connectionManager;
        this.queryExecutor = queryExecutor;
        this.connectionService = connectionService;
        this.historyService = historyService;
        this.auditLog = auditLog;
    }

    public QueryResult execute(String connectionId, String sql, int maxRows) {
        return execute(connectionId, sql, maxRows, null);
    }

    public QueryResult execute(String connectionId, String sql, int maxRows, String executionId) {
        ConnectionInfo info = connectionService.getConnection(connectionId);
        DataSource ds = connectionManager.getOrCreate(info);
        QueryResult result = queryExecutor.execute(ds, sql, maxRows, executionId);

        // Auto-reconnect: if connection error, retry once
        if (result.isError() && isConnectionError(result.getErrorMessage())) {
            ds = connectionManager.reconnect(info);
            result = queryExecutor.execute(ds, sql, maxRows, executionId);
        }

        // Audit log
        auditLog.logQuery(connectionId, info.getName(), sql, !result.isError(), result.getExecutionTimeMs());

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

    public QueryResult deleteRow(String connectionId, String schema, String table,
                                  Map<String, Object> primaryKeys) {
        if (primaryKeys == null || primaryKeys.isEmpty()) {
            return QueryResult.ofError("No primary key provided for delete", 0);
        }

        ConnectionInfo info = connectionService.getConnection(connectionId);
        DataSource ds = connectionManager.getOrCreate(info);
        String qualifiedTable = qualifyTable(schema, table);

        StringJoiner whereJoiner = new StringJoiner(" AND ");
        for (String pkCol : primaryKeys.keySet()) {
            whereJoiner.add(quoteIdentifier(pkCol) + " = ?");
        }

        String sql = "DELETE FROM " + qualifiedTable + " WHERE " + whereJoiner;
        long start = System.currentTimeMillis();
        try (Connection conn = ds.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            int idx = 1;
            for (Object pkVal : primaryKeys.values()) {
                ps.setObject(idx++, pkVal);
            }
            int affected = ps.executeUpdate();
            return QueryResult.ofUpdate(affected, System.currentTimeMillis() - start);
        } catch (SQLException e) {
            return QueryResult.ofError(e.getMessage(), System.currentTimeMillis() - start);
        }
    }

    public QueryResult insertRow(String connectionId, String schema, String table,
                                  Map<String, Object> values) {
        if (values == null || values.isEmpty()) {
            return QueryResult.ofError("No values provided for insert", 0);
        }

        ConnectionInfo info = connectionService.getConnection(connectionId);
        DataSource ds = connectionManager.getOrCreate(info);
        String qualifiedTable = qualifyTable(schema, table);

        StringJoiner cols = new StringJoiner(", ");
        StringJoiner placeholders = new StringJoiner(", ");
        for (String col : values.keySet()) {
            cols.add(quoteIdentifier(col));
            placeholders.add("?");
        }

        String sql = "INSERT INTO " + qualifiedTable + " (" + cols + ") VALUES (" + placeholders + ")";
        long start = System.currentTimeMillis();
        try (Connection conn = ds.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            int idx = 1;
            for (Object val : values.values()) {
                if (val == null || "null".equalsIgnoreCase(String.valueOf(val))) {
                    ps.setObject(idx++, null);
                } else {
                    ps.setObject(idx++, val);
                }
            }
            int affected = ps.executeUpdate();
            return QueryResult.ofUpdate(affected, System.currentTimeMillis() - start);
        } catch (SQLException e) {
            return QueryResult.ofError(e.getMessage(), System.currentTimeMillis() - start);
        }
    }

    private String qualifyTable(String schema, String table) {
        return (schema != null && !schema.isEmpty())
                ? quoteIdentifier(schema) + "." + quoteIdentifier(table)
                : quoteIdentifier(table);
    }

    private boolean isConnectionError(String msg) {
        if (msg == null) return false;
        String lower = msg.toLowerCase();
        return lower.contains("connection") || lower.contains("closed") ||
               lower.contains("refused") || lower.contains("timeout") ||
               lower.contains("communications link") || lower.contains("broken pipe");
    }

    private String quoteIdentifier(String name) {
        // Default ANSI quoting — use dialect-specific when connection context available
        return "\"" + name.replace("\"", "\"\"") + "\"";
    }

    private String quoteIdentifier(String name, ConnectionInfo info) {
        DatabaseDialect dialect = DialectFactory.getDialect(info.getDatabaseType());
        return dialect.quoteIdentifier(name);
    }
}
