package com.dbee.service;

import com.dbee.db.ConnectionManager;
import com.dbee.db.DialectFactory;
import com.dbee.db.MetadataReader;
import com.dbee.model.*;
import org.springframework.stereotype.Service;

import com.dbee.controller.dto.AutoCompleteMetadataDto;
import com.dbee.controller.dto.AutoCompleteMetadataDto.SchemaDto;
import com.dbee.controller.dto.AutoCompleteMetadataDto.TableDto;
import com.dbee.controller.dto.AutoCompleteMetadataDto.ColumnDto;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

@Service
public class MetadataService {
    private final ConnectionManager connectionManager;
    private final ConnectionService connectionService;

    public MetadataService(ConnectionManager connectionManager, ConnectionService connectionService) {
        this.connectionManager = connectionManager;
        this.connectionService = connectionService;
    }

    public List<SchemaInfo> getSchemas(String connectionId) {
        ConnectionInfo info = connectionService.getConnection(connectionId);
        DataSource ds = connectionManager.getOrCreate(info);
        try (Connection conn = ds.getConnection()) {
            MetadataReader reader = DialectFactory.getDialect(info.getDatabaseType())
                    .createMetadataReader(conn);
            return reader.getSchemas();
        } catch (SQLException e) {
            throw new RuntimeException("Failed to read schemas: " + e.getMessage(), e);
        }
    }

    public List<TableInfo> getTables(String connectionId, String schema) {
        ConnectionInfo info = connectionService.getConnection(connectionId);
        DataSource ds = connectionManager.getOrCreate(info);
        try (Connection conn = ds.getConnection()) {
            MetadataReader reader = DialectFactory.getDialect(info.getDatabaseType())
                    .createMetadataReader(conn);
            return reader.getTables(schema);
        } catch (SQLException e) {
            throw new RuntimeException("Failed to read tables: " + e.getMessage(), e);
        }
    }

    public List<ColumnInfo> getColumns(String connectionId, String schema, String table) {
        ConnectionInfo info = connectionService.getConnection(connectionId);
        DataSource ds = connectionManager.getOrCreate(info);
        try (Connection conn = ds.getConnection()) {
            MetadataReader reader = DialectFactory.getDialect(info.getDatabaseType())
                    .createMetadataReader(conn);
            return reader.getColumns(schema, table);
        } catch (SQLException e) {
            throw new RuntimeException("Failed to read columns: " + e.getMessage(), e);
        }
    }

    public List<RoutineInfo> getRoutines(String connectionId, String schema) {
        ConnectionInfo info = connectionService.getConnection(connectionId);
        DataSource ds = connectionManager.getOrCreate(info);
        try (Connection conn = ds.getConnection()) {
            MetadataReader reader = DialectFactory.getDialect(info.getDatabaseType())
                    .createMetadataReader(conn);
            return reader.getRoutines(schema);
        } catch (SQLException e) {
            throw new RuntimeException("Failed to read routines: " + e.getMessage(), e);
        }
    }

    public AutoCompleteMetadataDto getAutoCompleteMetadata(String connectionId) {
        ConnectionInfo info = connectionService.getConnection(connectionId);
        DataSource ds = connectionManager.getOrCreate(info);
        try (Connection conn = ds.getConnection()) {
            MetadataReader reader = DialectFactory.getDialect(info.getDatabaseType())
                    .createMetadataReader(conn);
            List<SchemaInfo> schemas = reader.getSchemas();
            List<SchemaDto> schemaDtos = new ArrayList<>();

            for (SchemaInfo schema : schemas) {
                List<TableInfo> tables = reader.getTables(schema.name());
                List<TableDto> tableDtos = new ArrayList<>();

                for (TableInfo table : tables) {
                    List<ColumnInfo> columns = reader.getColumns(schema.name(), table.name());
                    List<ColumnDto> columnDtos = columns.stream()
                            .map(c -> new ColumnDto(c.name(), c.typeName()))
                            .toList();
                    tableDtos.add(new TableDto(table.name(), table.type(), columnDtos));
                }

                schemaDtos.add(new SchemaDto(schema.name(), tableDtos));
            }

            return new AutoCompleteMetadataDto(schemaDtos);
        } catch (SQLException e) {
            throw new RuntimeException("Failed to read autocomplete metadata: " + e.getMessage(), e);
        }
    }

    public List<PrimaryKeyInfo> getPrimaryKeys(String connectionId, String schema, String table) {
        ConnectionInfo info = connectionService.getConnection(connectionId);
        DataSource ds = connectionManager.getOrCreate(info);
        try (Connection conn = ds.getConnection()) {
            MetadataReader reader = DialectFactory.getDialect(info.getDatabaseType())
                    .createMetadataReader(conn);
            return reader.getPrimaryKeys(schema, table);
        } catch (SQLException e) {
            throw new RuntimeException("Failed to read primary keys: " + e.getMessage(), e);
        }
    }

    public List<IndexInfo> getIndexes(String connectionId, String schema, String table) {
        ConnectionInfo info = connectionService.getConnection(connectionId);
        DataSource ds = connectionManager.getOrCreate(info);
        try (Connection conn = ds.getConnection()) {
            MetadataReader reader = DialectFactory.getDialect(info.getDatabaseType())
                    .createMetadataReader(conn);
            return reader.getIndexes(schema, table);
        } catch (SQLException e) {
            throw new RuntimeException("Failed to read indexes: " + e.getMessage(), e);
        }
    }

    public String getTableDdl(String connectionId, String schema, String table) {
        ConnectionInfo info = connectionService.getConnection(connectionId);
        DataSource ds = connectionManager.getOrCreate(info);
        var dialect = DialectFactory.getDialect(info.getDatabaseType());
        String ddlQuery = dialect.getShowCreateTableQuery(schema, table);

        if (ddlQuery == null) {
            // Reconstruct DDL from metadata for databases without native SHOW CREATE TABLE
            return reconstructDdl(connectionId, schema, table);
        }

        try (Connection conn = ds.getConnection();
             var stmt = conn.createStatement();
             var rs = stmt.executeQuery(ddlQuery)) {
            if (rs.next()) {
                // MySQL returns 2 columns: Table, Create Table
                int colCount = rs.getMetaData().getColumnCount();
                return colCount >= 2 ? rs.getString(2) : rs.getString(1);
            }
            return "-- No DDL found";
        } catch (SQLException e) {
            return "-- Error: " + e.getMessage();
        }
    }

    private String reconstructDdl(String connectionId, String schema, String table) {
        var columns = getColumns(connectionId, schema, table);
        var pks = getPrimaryKeys(connectionId, schema, table);
        StringBuilder sb = new StringBuilder();
        sb.append("CREATE TABLE ").append(table).append(" (\n");
        for (int i = 0; i < columns.size(); i++) {
            var col = columns.get(i);
            sb.append("  ").append(col.name()).append(" ").append(col.typeName());
            if (col.size() > 0) sb.append("(").append(col.size()).append(")");
            if (!col.nullable()) sb.append(" NOT NULL");
            if (i < columns.size() - 1 || !pks.isEmpty()) sb.append(",");
            sb.append("\n");
        }
        if (!pks.isEmpty()) {
            sb.append("  PRIMARY KEY (");
            sb.append(String.join(", ", pks.stream().map(PrimaryKeyInfo::columnName).toList()));
            sb.append(")\n");
        }
        sb.append(");");
        return sb.toString();
    }

    public List<java.util.Map<String, String>> getForeignKeys(String connectionId, String schema, String table) {
        ConnectionInfo info = connectionService.getConnection(connectionId);
        DataSource ds = connectionManager.getOrCreate(info);
        try (Connection conn = ds.getConnection()) {
            MetadataReader reader = DialectFactory.getDialect(info.getDatabaseType())
                    .createMetadataReader(conn);
            return reader.getForeignKeys(schema, table);
        } catch (SQLException e) {
            return List.of();
        }
    }

    public String generateErDiagram(String connectionId, String schema) {
        ConnectionInfo info = connectionService.getConnection(connectionId);
        DataSource ds = connectionManager.getOrCreate(info);
        try (Connection conn = ds.getConnection()) {
            MetadataReader reader = DialectFactory.getDialect(info.getDatabaseType())
                    .createMetadataReader(conn);
            List<TableInfo> tables = reader.getTables(schema);

            StringBuilder mermaid = new StringBuilder("erDiagram\n");
            for (TableInfo table : tables) {
                if (!"TABLE".equalsIgnoreCase(table.type())) continue;
                List<ColumnInfo> cols = reader.getColumns(schema, table.name());
                List<PrimaryKeyInfo> pks = reader.getPrimaryKeys(schema, table.name());
                var pkNames = pks.stream().map(PrimaryKeyInfo::columnName).toList();

                mermaid.append("    ").append(table.name()).append(" {\n");
                for (ColumnInfo col : cols) {
                    String pkMark = pkNames.contains(col.name()) ? " PK" : "";
                    mermaid.append("        ").append(col.typeName().replaceAll("[\\s()]", "_"))
                            .append(" ").append(col.name()).append(pkMark).append("\n");
                }
                mermaid.append("    }\n");

                // Foreign keys
                var fks = reader.getForeignKeys(schema, table.name());
                for (var fk : fks) {
                    mermaid.append("    ").append(fk.get("pkTable"))
                            .append(" ||--o{ ").append(table.name())
                            .append(" : \"").append(fk.get("fkColumn")).append("\"\n");
                }
            }
            return mermaid.toString();
        } catch (SQLException e) {
            return "erDiagram\n    %% Error: " + e.getMessage();
        }
    }

    public List<EventInfo> getEvents(String connectionId, String schema) {
        ConnectionInfo info = connectionService.getConnection(connectionId);
        DataSource ds = connectionManager.getOrCreate(info);
        try (Connection conn = ds.getConnection()) {
            MetadataReader reader = DialectFactory.getDialect(info.getDatabaseType())
                    .createMetadataReader(conn);
            return reader.getEvents(schema);
        } catch (SQLException e) {
            throw new RuntimeException("Failed to read events: " + e.getMessage(), e);
        }
    }
}
