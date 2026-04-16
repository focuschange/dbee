package com.dbee.db;

import com.dbee.model.*;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;

public class JdbcMetadataReader implements MetadataReader {
    private final Connection connection;
    private final boolean useCatalogAsSchema;

    public JdbcMetadataReader(Connection connection) {
        this(connection, false);
    }

    public JdbcMetadataReader(Connection connection, boolean useCatalogAsSchema) {
        this.connection = connection;
        this.useCatalogAsSchema = useCatalogAsSchema;
    }

    @Override
    public List<SchemaInfo> getSchemas() {
        List<SchemaInfo> schemas = new ArrayList<>();
        try {
            DatabaseMetaData meta = connection.getMetaData();
            if (useCatalogAsSchema) {
                try (ResultSet rs = meta.getCatalogs()) {
                    while (rs.next()) {
                        String catalog = rs.getString("TABLE_CAT");
                        schemas.add(new SchemaInfo(catalog, catalog));
                    }
                }
            } else {
                try (ResultSet rs = meta.getSchemas()) {
                    while (rs.next()) {
                        String schemaName = rs.getString("TABLE_SCHEM");
                        String catalog = rs.getString("TABLE_CATALOG");
                        schemas.add(new SchemaInfo(schemaName, catalog));
                    }
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("Failed to read schemas", e);
        }
        return schemas;
    }

    @Override
    public List<TableInfo> getTables(String schema) {
        List<TableInfo> tables = new ArrayList<>();
        try {
            DatabaseMetaData meta = connection.getMetaData();
            String catalog = useCatalogAsSchema ? schema : null;
            String schemaPattern = useCatalogAsSchema ? null : schema;
            try (ResultSet rs = meta.getTables(catalog, schemaPattern, "%",
                    new String[]{"TABLE", "VIEW"})) {
                while (rs.next()) {
                    tables.add(new TableInfo(
                            rs.getString("TABLE_NAME"),
                            schema,
                            rs.getString("TABLE_TYPE")));
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("Failed to read tables", e);
        }
        return tables;
    }

    @Override
    public List<ColumnInfo> getColumns(String schema, String table) {
        List<ColumnInfo> columns = new ArrayList<>();
        try {
            DatabaseMetaData meta = connection.getMetaData();
            String catalog = useCatalogAsSchema ? schema : null;
            String schemaPattern = useCatalogAsSchema ? null : schema;
            try (ResultSet rs = meta.getColumns(catalog, schemaPattern, table, "%")) {
                while (rs.next()) {
                    columns.add(new ColumnInfo(
                            rs.getString("COLUMN_NAME"),
                            rs.getString("TYPE_NAME"),
                            rs.getInt("COLUMN_SIZE"),
                            rs.getInt("NULLABLE") == DatabaseMetaData.columnNullable));
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("Failed to read columns", e);
        }
        return columns;
    }

    @Override
    public List<RoutineInfo> getRoutines(String schema) {
        List<RoutineInfo> routines = new ArrayList<>();
        try {
            DatabaseMetaData meta = connection.getMetaData();
            String catalog = useCatalogAsSchema ? schema : null;
            String schemaPattern = useCatalogAsSchema ? null : schema;
            try (ResultSet rs = meta.getProcedures(catalog, schemaPattern, "%")) {
                while (rs.next()) {
                    String name = rs.getString("PROCEDURE_NAME");
                    int typeCode = rs.getInt("PROCEDURE_TYPE");
                    String type = typeCode == DatabaseMetaData.procedureReturnsResult ? "FUNCTION" : "PROCEDURE";
                    routines.add(new RoutineInfo(name, schema, type, null));
                }
            }
            try (ResultSet rs = meta.getFunctions(catalog, schemaPattern, "%")) {
                while (rs.next()) {
                    String name = rs.getString("FUNCTION_NAME");
                    boolean exists = routines.stream().anyMatch(r -> r.name().equals(name));
                    if (!exists) {
                        routines.add(new RoutineInfo(name, schema, "FUNCTION", null));
                    }
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("Failed to read routines", e);
        }
        return routines;
    }

    @Override
    public List<PrimaryKeyInfo> getPrimaryKeys(String schema, String table) {
        List<PrimaryKeyInfo> keys = new ArrayList<>();
        try {
            DatabaseMetaData meta = connection.getMetaData();
            String catalog = useCatalogAsSchema ? schema : null;
            String schemaPattern = useCatalogAsSchema ? null : schema;
            try (ResultSet rs = meta.getPrimaryKeys(catalog, schemaPattern, table)) {
                while (rs.next()) {
                    keys.add(new PrimaryKeyInfo(
                            rs.getString("COLUMN_NAME"),
                            rs.getInt("KEY_SEQ")));
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("Failed to read primary keys", e);
        }
        return keys;
    }

    @Override
    public List<IndexInfo> getIndexes(String schema, String table) {
        List<IndexInfo> indexes = new ArrayList<>();
        try {
            DatabaseMetaData meta = connection.getMetaData();
            String catalog = useCatalogAsSchema ? schema : null;
            String schemaPattern = useCatalogAsSchema ? null : schema;
            try (ResultSet rs = meta.getIndexInfo(catalog, schemaPattern, table, false, false)) {
                while (rs.next()) {
                    String indexName = rs.getString("INDEX_NAME");
                    if (indexName == null) continue;
                    indexes.add(new IndexInfo(
                            indexName,
                            rs.getString("COLUMN_NAME"),
                            !rs.getBoolean("NON_UNIQUE"),
                            rs.getInt("ORDINAL_POSITION"),
                            rs.getInt("TYPE") == DatabaseMetaData.tableIndexStatistic ? "STATISTIC" : "INDEX"));
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("Failed to read indexes", e);
        }
        return indexes;
    }

    @Override
    public List<EventInfo> getEvents(String schema) {
        List<EventInfo> events = new ArrayList<>();
        try {
            String catalog = useCatalogAsSchema ? schema : null;
            String sql = "SELECT EVENT_NAME, EVENT_SCHEMA, STATUS FROM information_schema.EVENTS WHERE EVENT_SCHEMA = ?";
            try (PreparedStatement ps = connection.prepareStatement(sql)) {
                ps.setString(1, schema);
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        events.add(new EventInfo(
                                rs.getString("EVENT_NAME"),
                                rs.getString("EVENT_SCHEMA"),
                                rs.getString("STATUS")));
                    }
                }
            }
        } catch (SQLException e) {
            // Events not supported on this database - return empty
        }
        return events;
    }
}
