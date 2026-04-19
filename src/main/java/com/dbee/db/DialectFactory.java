package com.dbee.db;

import com.dbee.db.dialect.*;
import com.dbee.model.DatabaseType;

import java.util.EnumMap;
import java.util.Map;

public class DialectFactory {
    private static final Map<DatabaseType, DatabaseDialect> DIALECTS = new EnumMap<>(DatabaseType.class);

    static {
        DIALECTS.put(DatabaseType.MYSQL, new MySQLDialect());
        DIALECTS.put(DatabaseType.POSTGRESQL, new PostgreSQLDialect());
        DIALECTS.put(DatabaseType.ORACLE, new OracleDialect());
        DIALECTS.put(DatabaseType.SQLITE, new SQLiteDialect());
        DIALECTS.put(DatabaseType.MSSQL, new MSSQLDialect());
        DIALECTS.put(DatabaseType.ATHENA, new AthenaDialect());
        DIALECTS.put(DatabaseType.CLICKHOUSE, new ClickHouseDialect());
        DIALECTS.put(DatabaseType.DUCKDB, new DuckDBDialect());
        DIALECTS.put(DatabaseType.MONGODB, new MongoDBDialect());
        DIALECTS.put(DatabaseType.REDIS, new RedisDialect());
        DIALECTS.put(DatabaseType.ELASTICSEARCH, new ElasticSearchDialect());
    }

    public static DatabaseDialect getDialect(DatabaseType type) {
        DatabaseDialect dialect = DIALECTS.get(type);
        if (dialect == null) {
            throw new IllegalArgumentException("No dialect for: " + type);
        }
        return dialect;
    }
}
