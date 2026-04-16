# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

```bash
# Build
./gradlew build

# Run the application (serves on port 8765)
./gradlew bootRun

# Run tests
./gradlew test

# Run a single test class
./gradlew test --tests "com.dbee.SomeTest"

# Clean build
./gradlew clean build
```

## Architecture

Spring Boot 3.4.4 web application (Java 23) — **DBee** 🐝 — a browser-based SQL client supporting MySQL, PostgreSQL, Oracle, SQLite, MSSQL, and Amazon Athena. The frontend is a single-page app served as static resources (Monaco Editor for SQL editing).

### Layer Structure

**Controllers** (`controller/`) → **Services** (`service/`) → **DB Layer** (`db/`)

- Controllers handle REST API endpoints under `/api/`
- Services contain business logic and delegate to the DB layer
- The DB layer manages JDBC connections, query execution, and metadata reading

### Key Subsystems

**Database Dialect System** — `DatabaseDialect` interface with per-database implementations in `db/dialect/`. `DialectFactory` creates the right dialect from `DatabaseType`. Each dialect provides validation queries, LIMIT clause syntax, and a `MetadataReader`.

**Connection Management** — `ConnectionManager` maintains a map of HikariCP pools keyed by connection ID. SSH tunnel integration is transparent: when a tunnel is mapped to a connection, the JDBC URL is rewritten to localhost with the forwarded port.

**SSH Tunnels** — `SshTunnelManager` uses JSch to create SSH sessions with password or private key auth. Port forwarding is cached per tunnel+remote target. `SshTunnelService` persists tunnel configs to `~/.dbee/ssh-tunnels.json`.

**Configuration Persistence** — Connection and SSH tunnel configs are stored as JSON in `~/.dbee/` (managed by `ConnectionConfig` and `SshTunnelConfig`). Legacy `~/.dbclient/` data is auto-migrated on first launch.

**Query Execution** — `QueryExecutor` runs SQL synchronously or via `CompletableFuture`. Results are wrapped in `QueryResult` records and converted to `QueryResultDto` for JSON serialization (handling types like Timestamp, Date, binary data).

**Export** — `Exporter` interface with `CsvExporter` implementation. Streams results via HTTP response through `ExportController`.

### Frontend

Single `index.html` SPA in `src/main/resources/static/` with `app.js` and `app.css`. Uses Monaco Editor for SQL editing, supports dark/light/normal themes, and has a schema explorer sidebar with tree navigation of schemas/tables/columns.
