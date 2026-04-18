package com.dbee.db.dialect;

import com.dbee.db.DatabaseDialect;
import com.dbee.db.MetadataReader;
import com.dbee.model.DatabaseType;

import java.sql.Connection;

public class ElasticSearchDialect implements DatabaseDialect {
    @Override public DatabaseType getType() { return DatabaseType.ELASTICSEARCH; }
    @Override public String getValidationQuery() { return "SELECT 1"; }
    @Override public String getLimitClause(int limit) { return "LIMIT " + limit; }

    @Override
    public MetadataReader createMetadataReader(Connection conn) {
        throw new UnsupportedOperationException("ElasticSearch uses REST API; metadata is served via ElasticSearchClient");
    }

    @Override public String getExplainQuery(String sql) { return null; }
    @Override public boolean supportsExplainAnalyze() { return false; }
}
