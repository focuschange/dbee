package com.dbee.db.dialect;

import com.dbee.db.DatabaseDialect;
import com.dbee.db.JdbcMetadataReader;
import com.dbee.db.MetadataReader;
import com.dbee.model.DatabaseType;

import java.sql.Connection;

public class RedisDialect implements DatabaseDialect {
    @Override public DatabaseType getType() { return DatabaseType.REDIS; }
    @Override public String getValidationQuery() { return "PING"; }
    @Override public String getLimitClause(int limit) { return "LIMIT " + limit; }
    @Override public MetadataReader createMetadataReader(Connection conn) { return new JdbcMetadataReader(conn); }
    @Override public String getExplainQuery(String sql) { return null; }
}
