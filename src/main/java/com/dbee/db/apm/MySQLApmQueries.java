package com.dbee.db.apm;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

public class MySQLApmQueries implements ApmQueries {

    /** information_schema.PROCESSLIST is universally available on MySQL 5.6+/MariaDB. */
    private static final String LIST_SQL =
            "SELECT ID, USER, HOST, DB, COMMAND, STATE, TIME, INFO " +
            "FROM information_schema.PROCESSLIST " +
            "WHERE ID <> CONNECTION_ID() " +
            "ORDER BY (COMMAND = 'Sleep'), TIME DESC " +
            "LIMIT ?";

    @Override
    public List<ServerSession> listSessions(DataSource ds, int limit) throws Exception {
        List<ServerSession> out = new ArrayList<>();
        try (Connection c = ds.getConnection();
             PreparedStatement ps = c.prepareStatement(LIST_SQL)) {
            ps.setInt(1, Math.max(1, Math.min(limit, 500)));
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    long id = rs.getLong("ID");
                    String user = rs.getString("USER");
                    String host = rs.getString("HOST");
                    String db = rs.getString("DB");
                    String command = rs.getString("COMMAND");
                    String state = rs.getString("STATE");
                    long secs = rs.getLong("TIME");
                    String info = rs.getString("INFO");
                    String stateLabel = (command != null ? command : "") +
                            (state != null && !state.isEmpty() ? " / " + state : "");
                    Long durationMs = secs > 0 ? secs * 1000L : 0L;
                    String startedAt = secs > 0 ? Instant.now().minusSeconds(secs).toString() : null;
                    out.add(new ServerSession(
                            String.valueOf(id), user, host, db,
                            stateLabel.trim(), info,
                            startedAt, durationMs
                    ));
                }
            }
        }
        return out;
    }

    @Override
    public void killSession(DataSource ds, String sessionId) throws Exception {
        long id = Long.parseLong(sessionId);
        try (Connection c = ds.getConnection();
             Statement st = c.createStatement()) {
            // KILL doesn't accept bind parameters on most MySQL drivers.
            // sessionId was already parsed to a long, so string concat is safe.
            st.execute("KILL " + id);
        }
    }
}
