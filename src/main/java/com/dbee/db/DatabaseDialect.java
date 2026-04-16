package com.dbee.db;

import com.dbee.model.DatabaseType;

import java.sql.Connection;

public interface DatabaseDialect {
    DatabaseType getType();
    String getValidationQuery();
    String getLimitClause(int limit);
    MetadataReader createMetadataReader(Connection connection);
}
