package com.dbee.model;

import java.util.Collections;
import java.util.List;

public class QueryResult {
    private final List<String> columnNames;
    private final List<Class<?>> columnTypes;
    private final List<String> columnTypeNames;
    private final List<Object[]> rows;
    private final int affectedRows;
    private final long executionTimeMs;
    private final String errorMessage;
    private final String tableName;
    private final String schemaName;

    private QueryResult(List<String> columnNames, List<Class<?>> columnTypes,
                        List<String> columnTypeNames, List<Object[]> rows,
                        int affectedRows, long executionTimeMs, String errorMessage,
                        String tableName, String schemaName) {
        this.columnNames = columnNames;
        this.columnTypes = columnTypes;
        this.columnTypeNames = columnTypeNames;
        this.rows = rows;
        this.affectedRows = affectedRows;
        this.executionTimeMs = executionTimeMs;
        this.errorMessage = errorMessage;
        this.tableName = tableName;
        this.schemaName = schemaName;
    }

    public static QueryResult ofSelect(List<String> columnNames, List<Class<?>> columnTypes,
                                       List<String> columnTypeNames, List<Object[]> rows,
                                       long executionTimeMs, String tableName, String schemaName) {
        return new QueryResult(columnNames, columnTypes, columnTypeNames, rows,
                -1, executionTimeMs, null, tableName, schemaName);
    }

    public static QueryResult ofUpdate(int affectedRows, long executionTimeMs) {
        return new QueryResult(Collections.emptyList(), Collections.emptyList(),
                Collections.emptyList(), Collections.emptyList(),
                affectedRows, executionTimeMs, null, null, null);
    }

    public static QueryResult ofError(String errorMessage, long executionTimeMs) {
        return new QueryResult(Collections.emptyList(), Collections.emptyList(),
                Collections.emptyList(), Collections.emptyList(),
                -1, executionTimeMs, errorMessage, null, null);
    }

    public boolean isError() { return errorMessage != null; }
    public boolean isSelect() { return !isError() && !columnNames.isEmpty(); }

    public List<String> getColumnNames() { return columnNames; }
    public List<Class<?>> getColumnTypes() { return columnTypes; }
    public List<String> getColumnTypeNames() { return columnTypeNames; }
    public List<Object[]> getRows() { return rows; }
    public int getAffectedRows() { return affectedRows; }
    public long getExecutionTimeMs() { return executionTimeMs; }
    public String getErrorMessage() { return errorMessage; }
    public String getTableName() { return tableName; }
    public String getSchemaName() { return schemaName; }
}
