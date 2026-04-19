package com.dbee.db.apm;

/**
 * #139 — unified server-side session view across database dialects.
 * Fields are nullable where a given backend doesn't expose them.
 */
public record ServerSession(
        String sessionId,
        String user,
        String host,
        String database,
        String state,
        String query,
        String startedAt,
        Long durationMs
) {}
