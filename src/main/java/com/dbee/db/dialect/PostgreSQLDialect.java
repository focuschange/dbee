package com.dbee.db.dialect;

import com.dbee.db.DatabaseDialect;
import com.dbee.db.JdbcMetadataReader;
import com.dbee.db.MetadataReader;
import com.dbee.model.DatabaseType;

import java.sql.Connection;

public class PostgreSQLDialect implements DatabaseDialect {
    @Override
    public DatabaseType getType() { return DatabaseType.POSTGRESQL; }

    @Override
    public String getValidationQuery() { return "SELECT 1"; }

    @Override
    public String getLimitClause(int limit) { return "LIMIT " + limit; }

    @Override
    public MetadataReader createMetadataReader(Connection connection) {
        return new JdbcMetadataReader(connection);
    }
}
