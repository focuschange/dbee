package com.dbee.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public class QueryHistory {
    private String id;
    private String sql;
    private String connectionId;
    private String connectionName;
    private long executedAt;
    private long executionTimeMs;
    private int rowCount;
    private boolean error;
    private String errorMessage;

    public QueryHistory() {
        this.id = UUID.randomUUID().toString();
        this.executedAt = System.currentTimeMillis();
    }

    public QueryHistory(String sql, String connectionId, String connectionName,
                        long executionTimeMs, int rowCount, boolean error, String errorMessage) {
        this();
        this.sql = sql;
        this.connectionId = connectionId;
        this.connectionName = connectionName;
        this.executionTimeMs = executionTimeMs;
        this.rowCount = rowCount;
        this.error = error;
        this.errorMessage = errorMessage;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getSql() { return sql; }
    public void setSql(String sql) { this.sql = sql; }

    public String getConnectionId() { return connectionId; }
    public void setConnectionId(String connectionId) { this.connectionId = connectionId; }

    public String getConnectionName() { return connectionName; }
    public void setConnectionName(String connectionName) { this.connectionName = connectionName; }

    public long getExecutedAt() { return executedAt; }
    public void setExecutedAt(long executedAt) { this.executedAt = executedAt; }

    public long getExecutionTimeMs() { return executionTimeMs; }
    public void setExecutionTimeMs(long executionTimeMs) { this.executionTimeMs = executionTimeMs; }

    public int getRowCount() { return rowCount; }
    public void setRowCount(int rowCount) { this.rowCount = rowCount; }

    public boolean isError() { return error; }
    public void setError(boolean error) { this.error = error; }

    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
}
