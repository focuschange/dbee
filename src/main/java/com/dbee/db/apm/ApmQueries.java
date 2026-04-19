package com.dbee.db.apm;

import javax.sql.DataSource;
import java.util.Collections;
import java.util.List;

/**
 * Dialect-specific session discovery + kill. New dialects plug into
 * {@link ApmQueriesRegistry}. Unsupported dialects use the default
 * implementation which reports no data.
 */
public interface ApmQueries {
    default boolean isSupported() { return true; }

    default List<ServerSession> listSessions(DataSource ds, int limit) throws Exception {
        return Collections.emptyList();
    }

    default void killSession(DataSource ds, String sessionId) throws Exception {
        throw new UnsupportedOperationException("Kill not supported on this database");
    }

    /** Fallback used for dialects that have no concrete implementation yet. */
    ApmQueries NOOP = new ApmQueries() {
        @Override public boolean isSupported() { return false; }
    };
}
