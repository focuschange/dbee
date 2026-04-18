package com.dbee.service;

import com.dbee.db.ConnectionManager;
import com.dbee.db.DialectFactory;
import com.dbee.db.MetadataReader;
import com.dbee.db.es.ElasticSearchClient;
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
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class MetadataService {
    private final ConnectionManager connectionManager;
    private final ConnectionService connectionService;

    public MetadataService(ConnectionManager connectionManager, ConnectionService connectionService) {
        this.connectionManager = connectionManager;
        this.connectionService = connectionService;
    }

    private boolean isEs(ConnectionInfo info) {
        return info.getDatabaseType() == DatabaseType.ELASTICSEARCH;
    }

    public List<SchemaInfo> getSchemas(String connectionId) {
        ConnectionInfo info = connectionService.getConnection(connectionId);
        if (isEs(info)) {
            return connectionManager.getElasticSearchClient(info).getSchemas();
        }
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
        if (isEs(info)) {
            return connectionManager.getElasticSearchClient(info).listIndices();
        }
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
        if (isEs(info)) {
            return connectionManager.getElasticSearchClient(info).getColumns(table);
        }
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
        if (isEs(info)) return List.of();
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
        if (isEs(info)) {
            ElasticSearchClient client = connectionManager.getElasticSearchClient(info);
            List<SchemaInfo> schemas = client.getSchemas();
            List<SchemaDto> schemaDtos = new ArrayList<>();
            for (SchemaInfo schema : schemas) {
                List<TableInfo> tables = client.listIndices();
                List<TableDto> tableDtos = new ArrayList<>();
                for (TableInfo table : tables) {
                    List<ColumnInfo> columns = client.getColumns(table.name());
                    List<ColumnDto> columnDtos = columns.stream()
                            .map(c -> new ColumnDto(c.name(), c.typeName()))
                            .toList();
                    tableDtos.add(new TableDto(table.name(), table.type(), columnDtos));
                }
                schemaDtos.add(new SchemaDto(schema.name(), tableDtos));
            }
            return new AutoCompleteMetadataDto(schemaDtos);
        }
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
        if (isEs(info)) return List.of();
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
        if (isEs(info)) return List.of();
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
        if (isEs(info)) {
            return reconstructDdl(connectionId, schema, table);
        }
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
        if (isEs(info)) return List.of();
        DataSource ds = connectionManager.getOrCreate(info);
        try (Connection conn = ds.getConnection()) {
            MetadataReader reader = DialectFactory.getDialect(info.getDatabaseType())
                    .createMetadataReader(conn);
            return reader.getForeignKeys(schema, table);
        } catch (SQLException e) {
            return List.of();
        }
    }

    /**
     * Returns ERD as a structured graph (nodes = tables, edges = FKs).
     * Used by Cytoscape.js on the frontend.
     */
    public Map<String, Object> generateErGraph(String connectionId, String schema) {
        ConnectionInfo info = connectionService.getConnection(connectionId);
        if (isEs(info)) {
            return buildEsErGraph(info, schema);
        }
        DataSource ds = connectionManager.getOrCreate(info);
        try (Connection conn = ds.getConnection()) {
            MetadataReader reader = DialectFactory.getDialect(info.getDatabaseType())
                    .createMetadataReader(conn);
            List<TableInfo> tables = reader.getTables(schema);

            List<Map<String, Object>> nodes = new ArrayList<>();
            List<Map<String, Object>> edges = new ArrayList<>();
            int edgeId = 0;

            for (TableInfo table : tables) {
                if (!"TABLE".equalsIgnoreCase(table.type())) continue;

                List<ColumnInfo> cols = reader.getColumns(schema, table.name());
                List<PrimaryKeyInfo> pks = reader.getPrimaryKeys(schema, table.name());
                var pkNames = pks.stream().map(PrimaryKeyInfo::columnName).toList();
                var fks = reader.getForeignKeys(schema, table.name());

                // Collect FK column names for this table
                java.util.Set<String> fkColumns = new java.util.HashSet<>();
                for (var fk : fks) {
                    Object fkCol = fk.get("fkColumn");
                    if (fkCol != null) fkColumns.add(fkCol.toString());
                }

                List<Map<String, Object>> columnList = new ArrayList<>();
                for (ColumnInfo col : cols) {
                    Map<String, Object> c = new HashMap<>();
                    c.put("name", col.name());
                    c.put("type", col.typeName());
                    c.put("size", col.size());
                    c.put("nullable", col.nullable());
                    c.put("pk", pkNames.contains(col.name()));
                    c.put("fk", fkColumns.contains(col.name()));
                    columnList.add(c);
                }

                Map<String, Object> node = new HashMap<>();
                node.put("id", table.name());
                node.put("label", table.name());
                node.put("schema", schema);
                node.put("columns", columnList);
                node.put("comment", "");
                nodes.add(node);

                for (var fk : fks) {
                    Map<String, Object> edge = new HashMap<>();
                    edge.put("id", "e" + (edgeId++));
                    edge.put("source", table.name());          // child (has FK)
                    edge.put("target", fk.get("pkTable"));     // parent (referenced)
                    edge.put("label", fk.get("fkColumn"));
                    edge.put("fkColumn", fk.get("fkColumn"));
                    edge.put("pkColumn", fk.get("pkColumn"));
                    edge.put("cardinality", "N:1");
                    edges.add(edge);
                }
            }

            Map<String, Object> result = new HashMap<>();
            result.put("schema", schema);
            result.put("nodes", nodes);
            result.put("edges", edges);
            return result;
        } catch (SQLException e) {
            Map<String, Object> err = new HashMap<>();
            err.put("schema", schema);
            err.put("nodes", List.of());
            err.put("edges", List.of());
            err.put("error", "Failed to read ERD metadata");
            return err;
        }
    }

    private Map<String, Object> buildEsErGraph(ConnectionInfo info, String schema) {
        ElasticSearchClient client = connectionManager.getElasticSearchClient(info);
        List<TableInfo> tables = client.listIndices();
        List<Map<String, Object>> nodes = new ArrayList<>();
        for (TableInfo table : tables) {
            List<ColumnInfo> cols = client.getColumns(table.name());
            List<Map<String, Object>> columnList = new ArrayList<>();
            for (ColumnInfo col : cols) {
                Map<String, Object> c = new HashMap<>();
                c.put("name", col.name());
                c.put("type", col.typeName());
                c.put("size", col.size());
                c.put("nullable", col.nullable());
                c.put("pk", false);
                c.put("fk", false);
                columnList.add(c);
            }
            Map<String, Object> node = new HashMap<>();
            node.put("id", table.name());
            node.put("label", table.name());
            node.put("schema", schema);
            node.put("columns", columnList);
            node.put("comment", "");
            nodes.add(node);
        }
        Map<String, Object> result = new HashMap<>();
        result.put("schema", schema);
        result.put("nodes", nodes);
        result.put("edges", List.of());
        return result;
    }

    public String generateErDiagram(String connectionId, String schema) {
        ConnectionInfo info = connectionService.getConnection(connectionId);
        if (isEs(info)) {
            ElasticSearchClient client = connectionManager.getElasticSearchClient(info);
            List<TableInfo> tables = client.listIndices();
            StringBuilder mermaid = new StringBuilder("erDiagram\n");
            for (TableInfo table : tables) {
                List<ColumnInfo> cols = client.getColumns(table.name());
                mermaid.append("    ").append(table.name()).append(" {\n");
                for (ColumnInfo col : cols) {
                    mermaid.append("        ").append(col.typeName().replaceAll("[\\s()]", "_"))
                            .append(" ").append(col.name()).append("\n");
                }
                mermaid.append("    }\n");
            }
            return mermaid.toString();
        }
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
        if (isEs(info)) return List.of();
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
