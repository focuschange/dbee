package com.dbee.db;

import com.dbee.model.QueryResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.sql.DataSource;
import java.sql.*;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class QueryExecutor {
    private static final Logger log = LoggerFactory.getLogger(QueryExecutor.class);
    private static final int DEFAULT_MAX_ROWS = 1000;
    private final ExecutorService executor = Executors.newCachedThreadPool(r -> {
        Thread t = new Thread(r, "query-executor");
        t.setDaemon(true);
        return t;
    });

    public QueryResult execute(DataSource ds, String sql) {
        return execute(ds, sql, DEFAULT_MAX_ROWS);
    }

    public QueryResult execute(DataSource ds, String sql, int maxRows) {
        long start = System.currentTimeMillis();
        try (Connection conn = ds.getConnection();
             Statement stmt = conn.createStatement()) {
            stmt.setMaxRows(maxRows);

            boolean isResultSet = stmt.execute(sql.trim());
            long elapsed = System.currentTimeMillis() - start;

            if (isResultSet) {
                return buildSelectResult(stmt.getResultSet(), elapsed);
            } else {
                return QueryResult.ofUpdate(stmt.getUpdateCount(), elapsed);
            }
        } catch (SQLException e) {
            long elapsed = System.currentTimeMillis() - start;
            log.error("Query execution failed: {}", e.getMessage());
            return QueryResult.ofError(e.getMessage(), elapsed);
        }
    }

    public CompletableFuture<QueryResult> executeAsync(DataSource ds, String sql, int maxRows) {
        return CompletableFuture.supplyAsync(() -> execute(ds, sql, maxRows), executor);
    }

    public CompletableFuture<QueryResult> executeAsync(DataSource ds, String sql) {
        return executeAsync(ds, sql, DEFAULT_MAX_ROWS);
    }

    /**
     * Execute EXPLAIN for Oracle: runs EXPLAIN PLAN FOR, then reads DBMS_XPLAN.DISPLAY
     */
    public QueryResult executeOracleExplain(DataSource ds, String explainPlanSql, String originalSql) {
        long start = System.currentTimeMillis();
        try (Connection conn = ds.getConnection();
             Statement stmt = conn.createStatement()) {
            // Step 1: Execute EXPLAIN PLAN FOR ...
            stmt.execute(explainPlanSql);
            // Step 2: Read the plan from DBMS_XPLAN
            try (ResultSet rs = stmt.executeQuery(
                    "SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY(NULL, NULL, 'ALL'))")) {
                long elapsed = System.currentTimeMillis() - start;
                return buildSelectResult(rs, elapsed);
            }
        } catch (SQLException e) {
            long elapsed = System.currentTimeMillis() - start;
            log.error("Oracle EXPLAIN failed: {}", e.getMessage());
            return QueryResult.ofError(e.getMessage(), elapsed);
        }
    }

    /**
     * Execute EXPLAIN for MSSQL: SET SHOWPLAN_ALL ON, run query, SET SHOWPLAN_ALL OFF
     */
    public QueryResult executeMssqlExplain(DataSource ds, String sql) {
        long start = System.currentTimeMillis();
        try (Connection conn = ds.getConnection();
             Statement stmt = conn.createStatement()) {
            stmt.execute("SET SHOWPLAN_ALL ON");
            try {
                boolean isRs = stmt.execute(sql);
                long elapsed = System.currentTimeMillis() - start;
                if (isRs) {
                    return buildSelectResult(stmt.getResultSet(), elapsed);
                } else {
                    return QueryResult.ofError("No execution plan returned", elapsed);
                }
            } finally {
                try { stmt.execute("SET SHOWPLAN_ALL OFF"); } catch (Exception ignored) {}
            }
        } catch (SQLException e) {
            long elapsed = System.currentTimeMillis() - start;
            log.error("MSSQL EXPLAIN failed: {}", e.getMessage());
            return QueryResult.ofError(e.getMessage(), elapsed);
        }
    }

    public void shutdown() {
        executor.shutdownNow();
    }

    private QueryResult buildSelectResult(ResultSet rs, long elapsed) throws SQLException {
        ResultSetMetaData meta = rs.getMetaData();
        int colCount = meta.getColumnCount();

        List<String> columnNames = new ArrayList<>(colCount);
        List<Class<?>> columnTypes = new ArrayList<>(colCount);
        List<String> columnTypeNames = new ArrayList<>(colCount);

        // Extract table/schema name from first column (for single-table queries)
        String tableName = null;
        String schemaName = null;
        boolean singleTable = true;

        for (int i = 1; i <= colCount; i++) {
            columnNames.add(meta.getColumnLabel(i));
            columnTypes.add(mapSqlType(meta.getColumnType(i)));
            columnTypeNames.add(meta.getColumnTypeName(i));

            // Detect table name — all columns must come from the same table
            try {
                String tbl = meta.getTableName(i);
                String sch = meta.getSchemaName(i);
                if (sch == null || sch.isEmpty()) {
                    sch = meta.getCatalogName(i); // MySQL uses catalog
                }
                if (tbl != null && !tbl.isEmpty()) {
                    if (tableName == null) {
                        tableName = tbl;
                        schemaName = sch;
                    } else if (!tableName.equals(tbl)) {
                        singleTable = false;
                    }
                }
            } catch (Exception ignored) {
                // Some drivers may not support getTableName
            }
        }

        if (!singleTable) {
            tableName = null;
            schemaName = null;
        }

        List<Object[]> rows = new ArrayList<>();
        while (rs.next()) {
            Object[] row = new Object[colCount];
            for (int i = 1; i <= colCount; i++) {
                row[i - 1] = rs.getObject(i);
            }
            rows.add(row);
        }

        return QueryResult.ofSelect(columnNames, columnTypes, columnTypeNames, rows,
                elapsed, tableName, schemaName);
    }

    private Class<?> mapSqlType(int sqlType) {
        return switch (sqlType) {
            case Types.INTEGER, Types.SMALLINT, Types.TINYINT -> Integer.class;
            case Types.BIGINT -> Long.class;
            case Types.FLOAT, Types.REAL -> Float.class;
            case Types.DOUBLE -> Double.class;
            case Types.DECIMAL, Types.NUMERIC -> java.math.BigDecimal.class;
            case Types.BOOLEAN, Types.BIT -> Boolean.class;
            case Types.DATE -> java.sql.Date.class;
            case Types.TIMESTAMP, Types.TIMESTAMP_WITH_TIMEZONE -> java.sql.Timestamp.class;
            default -> String.class;
        };
    }
}
