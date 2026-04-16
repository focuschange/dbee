package com.dbee.db.dialect;

import com.dbee.db.DatabaseDialect;
import com.dbee.db.JdbcMetadataReader;
import com.dbee.db.MetadataReader;
import com.dbee.model.DatabaseType;

import java.sql.Connection;

public class SQLiteDialect implements DatabaseDialect {
    @Override
    public DatabaseType getType() { return DatabaseType.SQLITE; }

    @Override
    public String getValidationQuery() { return "SELECT 1"; }

    @Override
    public String getLimitClause(int limit) { return "LIMIT " + limit; }

    @Override
    public MetadataReader createMetadataReader(Connection connection) {
        return new JdbcMetadataReader(connection, true);
    }

    @Override
    public String getExplainQuery(String sql) {
        return "EXPLAIN QUERY PLAN " + sql;
    }

    @Override
    public String getExplainAnalyzeQuery(String sql) {
        return null; // SQLite doesn't support EXPLAIN ANALYZE
    }

    @Override
    public boolean supportsExplainAnalyze() {
        return false;
    }
}
