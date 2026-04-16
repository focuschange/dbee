package com.dbee.model;

import java.util.Collections;
import java.util.List;

public class QueryResult {
    private final List<String> columnNames;
    private final List<Class<?>> columnTypes;
    private final List<Object[]> rows;
    private final int affectedRows;
    private final long executionTimeMs;
    private final String errorMessage;

    private QueryResult(List<String> columnNames, List<Class<?>> columnTypes,
                        List<Object[]> rows, int affectedRows,
                        long executionTimeMs, String errorMessage) {
        this.columnNames = columnNames;
        this.columnTypes = columnTypes;
        this.rows = rows;
        this.affectedRows = affectedRows;
        this.executionTimeMs = executionTimeMs;
        this.errorMessage = errorMessage;
    }

    public static QueryResult ofSelect(List<String> columnNames, List<Class<?>> columnTypes,
                                       List<Object[]> rows, long executionTimeMs) {
        return new QueryResult(columnNames, columnTypes, rows, -1, executionTimeMs, null);
    }

    public static QueryResult ofUpdate(int affectedRows, long executionTimeMs) {
        return new QueryResult(Collections.emptyList(), Collections.emptyList(),
                Collections.emptyList(), affectedRows, executionTimeMs, null);
    }

    public static QueryResult ofError(String errorMessage, long executionTimeMs) {
        return new QueryResult(Collections.emptyList(), Collections.emptyList(),
                Collections.emptyList(), -1, executionTimeMs, errorMessage);
    }

    public boolean isError() { return errorMessage != null; }
    public boolean isSelect() { return !isError() && !columnNames.isEmpty(); }

    public List<String> getColumnNames() { return columnNames; }
    public List<Class<?>> getColumnTypes() { return columnTypes; }
    public List<Object[]> getRows() { return rows; }
    public int getAffectedRows() { return affectedRows; }
    public long getExecutionTimeMs() { return executionTimeMs; }
    public String getErrorMessage() { return errorMessage; }
}
