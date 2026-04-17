package com.dbee.db.dialect;

import com.dbee.db.DatabaseDialect;
import com.dbee.db.JdbcMetadataReader;
import com.dbee.db.MetadataReader;
import com.dbee.model.DatabaseType;

import java.sql.Connection;

public class MongoDBDialect implements DatabaseDialect {
    @Override public DatabaseType getType() { return DatabaseType.MONGODB; }
    @Override public String getValidationQuery() { return "SELECT 1"; }
    @Override public String getLimitClause(int limit) { return "LIMIT " + limit; }
    @Override public MetadataReader createMetadataReader(Connection conn) { return new JdbcMetadataReader(conn, true); }
    @Override public String getExplainQuery(String sql) { return null; }
}
