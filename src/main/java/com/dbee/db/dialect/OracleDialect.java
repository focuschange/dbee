package com.dbee.db.dialect;

import com.dbee.db.DatabaseDialect;
import com.dbee.db.JdbcMetadataReader;
import com.dbee.db.MetadataReader;
import com.dbee.model.DatabaseType;

import java.sql.Connection;

public class OracleDialect implements DatabaseDialect {
    @Override
    public DatabaseType getType() { return DatabaseType.ORACLE; }

    @Override
    public String getValidationQuery() { return "SELECT 1 FROM DUAL"; }

    @Override
    public String getLimitClause(int limit) { return "FETCH FIRST " + limit + " ROWS ONLY"; }

    @Override
    public MetadataReader createMetadataReader(Connection connection) {
        return new JdbcMetadataReader(connection);
    }

    @Override
    public String getExplainQuery(String sql) {
        // Oracle uses EXPLAIN PLAN FOR ... then SELECT from plan table
        return "EXPLAIN PLAN FOR " + sql;
    }

    @Override
    public String getExplainAnalyzeQuery(String sql) {
        return null; // Oracle doesn't support EXPLAIN ANALYZE directly
    }

    @Override
    public boolean supportsExplainAnalyze() {
        return false;
    }
}
