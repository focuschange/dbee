package com.dbee.db;

import com.dbee.model.QueryResult;
import org.junit.jupiter.api.*;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.Statement;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;

import static org.junit.jupiter.api.Assertions.*;

class QueryExecutorTest {
    private static HikariDataSource dataSource;
    private final QueryExecutor executor = new QueryExecutor();

    @BeforeAll
    static void setup() throws Exception {
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl("jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1");
        config.setUsername("sa");
        config.setPassword("");
        dataSource = new HikariDataSource(config);

        try (Connection conn = dataSource.getConnection();
             Statement stmt = conn.createStatement()) {
            stmt.execute("CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(100), email VARCHAR(200))");
            stmt.execute("INSERT INTO users VALUES (1, 'Alice', 'alice@test.com')");
            stmt.execute("INSERT INTO users VALUES (2, 'Bob', 'bob@test.com')");
        }
    }

    @AfterAll
    static void teardown() {
        if (dataSource != null) dataSource.close();
    }

    @Test
    void executeSelect() {
        QueryResult result = executor.execute(dataSource, "SELECT * FROM users", 100);
        assertFalse(result.isError());
        assertTrue(result.isSelect());
        assertEquals(3, result.getColumnNames().size());
        assertEquals(2, result.getRows().size());
    }

    @Test
    void executeUpdate() {
        QueryResult result = executor.execute(dataSource, "UPDATE users SET name='Alice2' WHERE id=1", 100);
        assertFalse(result.isError());
        assertFalse(result.isSelect());
        assertEquals(1, result.getAffectedRows());

        // Restore
        executor.execute(dataSource, "UPDATE users SET name='Alice' WHERE id=1", 100);
    }

    @Test
    void executeInvalidSql() {
        QueryResult result = executor.execute(dataSource, "INVALID SQL QUERY", 100);
        assertTrue(result.isError());
        assertNotNull(result.getErrorMessage());
    }

    @Test
    void cancelNonExistent() {
        assertFalse(executor.cancel("non-existent-id"));
    }
}
