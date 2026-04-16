package com.dbee.db;

import com.dbee.model.DatabaseType;

import java.sql.Connection;

public interface DatabaseDialect {
    DatabaseType getType();
    String getValidationQuery();
    String getLimitClause(int limit);
    MetadataReader createMetadataReader(Connection connection);

    /**
     * Returns the SQL to get the execution plan for the given query.
     * @return EXPLAIN SQL, or null if not supported
     */
    default String getExplainQuery(String sql) {
        return "EXPLAIN " + sql;
    }

    /**
     * Returns the SQL to get the execution plan with actual runtime statistics.
     * @return EXPLAIN ANALYZE SQL, or null if not supported
     */
    default String getExplainAnalyzeQuery(String sql) {
        return null; // not supported by default
    }

    /**
     * Whether this dialect supports EXPLAIN ANALYZE.
     */
    default boolean supportsExplainAnalyze() {
        return false;
    }

    /**
     * Returns SQL to get the DDL (CREATE TABLE) for a table.
     * Returns null if not supported natively.
     */
    default String getShowCreateTableQuery(String schema, String table) {
        return null;
    }

    /**
     * Quote an identifier (table/column name) for this dialect.
     */
    default String quoteIdentifier(String name) {
        // Default: ANSI SQL double-quotes
        return "\"" + name.replace("\"", "\"\"") + "\"";
    }
}
