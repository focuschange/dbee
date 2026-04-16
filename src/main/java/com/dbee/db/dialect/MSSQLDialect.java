package com.dbee.db.dialect;

import com.dbee.db.DatabaseDialect;
import com.dbee.db.JdbcMetadataReader;
import com.dbee.db.MetadataReader;
import com.dbee.model.DatabaseType;

import java.sql.Connection;

public class MSSQLDialect implements DatabaseDialect {
    @Override
    public DatabaseType getType() { return DatabaseType.MSSQL; }

    @Override
    public String getValidationQuery() { return "SELECT 1"; }

    @Override
    public String getLimitClause(int limit) { return "TOP " + limit; }

    @Override
    public MetadataReader createMetadataReader(Connection connection) {
        return new JdbcMetadataReader(connection, true);
    }

    @Override
    public String getExplainQuery(String sql) {
        // MSSQL uses SET SHOWPLAN_ALL ON before the query
        return "SET SHOWPLAN_ALL ON";
    }

    @Override
    public String getExplainAnalyzeQuery(String sql) {
        return null; // MSSQL doesn't support EXPLAIN ANALYZE directly
    }

    @Override
    public boolean supportsExplainAnalyze() {
        return false;
    }
}
