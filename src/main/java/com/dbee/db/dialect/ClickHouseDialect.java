package com.dbee.db.dialect;

import com.dbee.db.DatabaseDialect;
import com.dbee.db.JdbcMetadataReader;
import com.dbee.db.MetadataReader;
import com.dbee.model.DatabaseType;

import java.sql.Connection;

public class ClickHouseDialect implements DatabaseDialect {
    @Override public DatabaseType getType() { return DatabaseType.CLICKHOUSE; }
    @Override public String getValidationQuery() { return "SELECT 1"; }
    @Override public String getLimitClause(int limit) { return "LIMIT " + limit; }
    @Override public MetadataReader createMetadataReader(Connection conn) { return new JdbcMetadataReader(conn); }
    @Override public String getExplainQuery(String sql) { return "EXPLAIN " + sql; }
    @Override public boolean supportsExplainAnalyze() { return false; }
}
