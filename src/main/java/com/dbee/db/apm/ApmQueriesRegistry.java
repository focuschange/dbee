package com.dbee.db.apm;

import com.dbee.model.DatabaseType;

import java.util.EnumMap;
import java.util.Map;

/** Maps {@link DatabaseType} to its APM query implementation. */
public final class ApmQueriesRegistry {
    private static final Map<DatabaseType, ApmQueries> IMPLS = new EnumMap<>(DatabaseType.class);

    static {
        IMPLS.put(DatabaseType.POSTGRESQL, new PostgresApmQueries());
        IMPLS.put(DatabaseType.MYSQL, new MySQLApmQueries());
        // Other dialects fall back to the NOOP (isSupported=false).
    }

    private ApmQueriesRegistry() {}

    public static ApmQueries forType(DatabaseType type) {
        if (type == null) return ApmQueries.NOOP;
        return IMPLS.getOrDefault(type, ApmQueries.NOOP);
    }
}
