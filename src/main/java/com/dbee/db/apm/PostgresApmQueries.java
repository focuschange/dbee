package com.dbee.db.apm;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;

public class PostgresApmQueries implements ApmQueries {

    private static final String LIST_SQL =
            "SELECT pid, usename, client_addr, datname, state, query, " +
            "       query_start, EXTRACT(EPOCH FROM (clock_timestamp() - query_start)) * 1000 AS duration_ms " +
            "FROM pg_stat_activity " +
            "WHERE pid <> pg_backend_pid() " +
            "ORDER BY (CASE WHEN state = 'active' THEN 0 ELSE 1 END), query_start ASC NULLS LAST " +
            "LIMIT ?";

    @Override
    public List<ServerSession> listSessions(DataSource ds, int limit) throws Exception {
        List<ServerSession> out = new ArrayList<>();
        try (Connection c = ds.getConnection();
             PreparedStatement ps = c.prepareStatement(LIST_SQL)) {
            ps.setInt(1, Math.max(1, Math.min(limit, 500)));
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    int pid = rs.getInt("pid");
                    String user = rs.getString("usename");
                    String host = rs.getString("client_addr");
                    String db = rs.getString("datname");
                    String state = rs.getString("state");
                    String query = rs.getString("query");
                    Timestamp ts = rs.getTimestamp("query_start");
                    Long durationMs = rs.getObject("duration_ms") == null ? null : (long) rs.getDouble("duration_ms");
                    out.add(new ServerSession(
                            String.valueOf(pid), user, host, db, state, query,
                            ts == null ? null : ts.toInstant().toString(),
                            durationMs
                    ));
                }
            }
        }
        return out;
    }

    @Override
    public void killSession(DataSource ds, String sessionId) throws Exception {
        int pid = Integer.parseInt(sessionId);
        try (Connection c = ds.getConnection();
             PreparedStatement ps = c.prepareStatement("SELECT pg_terminate_backend(?)")) {
            ps.setInt(1, pid);
            ps.execute();
        }
    }
}
