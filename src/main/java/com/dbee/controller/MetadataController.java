package com.dbee.controller;

import com.dbee.controller.dto.AutoCompleteMetadataDto;
import com.dbee.model.*;
import com.dbee.service.MetadataService;
import com.dbee.service.ErdExportService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/metadata")
public class MetadataController {
    private final MetadataService metadataService;
    private final ErdExportService erdExportService;

    public MetadataController(MetadataService metadataService, ErdExportService erdExportService) {
        this.metadataService = metadataService;
        this.erdExportService = erdExportService;
    }

    @GetMapping("/{connectionId}/autocomplete")
    public AutoCompleteMetadataDto getAutoCompleteMetadata(@PathVariable String connectionId) {
        return metadataService.getAutoCompleteMetadata(connectionId);
    }

    @GetMapping("/{connectionId}/schemas")
    public List<SchemaInfo> getSchemas(@PathVariable String connectionId) {
        return metadataService.getSchemas(connectionId);
    }

    @GetMapping("/{connectionId}/schemas/{schema}/tables")
    public List<TableInfo> getTables(@PathVariable String connectionId, @PathVariable String schema) {
        return metadataService.getTables(connectionId, schema);
    }

    @GetMapping("/{connectionId}/schemas/{schema}/tables/{table}/columns")
    public List<ColumnInfo> getColumns(@PathVariable String connectionId,
                                       @PathVariable String schema,
                                       @PathVariable String table) {
        return metadataService.getColumns(connectionId, schema, table);
    }

    @GetMapping("/{connectionId}/schemas/{schema}/tables/{table}/primarykeys")
    public List<PrimaryKeyInfo> getPrimaryKeys(@PathVariable String connectionId,
                                                @PathVariable String schema,
                                                @PathVariable String table) {
        return metadataService.getPrimaryKeys(connectionId, schema, table);
    }

    @GetMapping("/{connectionId}/schemas/{schema}/tables/{table}/ddl")
    public java.util.Map<String, String> getTableDdl(@PathVariable String connectionId,
                                                      @PathVariable String schema,
                                                      @PathVariable String table) {
        String ddl = metadataService.getTableDdl(connectionId, schema, table);
        return java.util.Map.of("ddl", ddl);
    }

    @GetMapping("/{connectionId}/schemas/{schema}/tables/{table}/indexes")
    public List<IndexInfo> getIndexes(@PathVariable String connectionId,
                                      @PathVariable String schema,
                                      @PathVariable String table) {
        return metadataService.getIndexes(connectionId, schema, table);
    }

    @GetMapping("/{connectionId}/schemas/{schema}/documentation")
    public java.util.Map<String, String> getSchemaDocumentation(@PathVariable String connectionId,
                                                                  @PathVariable String schema) {
        var tables = metadataService.getTables(connectionId, schema);
        StringBuilder md = new StringBuilder();
        md.append("# Database Schema: ").append(schema).append("\n\n");
        md.append("Generated: ").append(java.time.LocalDateTime.now()).append("\n\n");
        md.append("## Tables\n\n");
        md.append("| # | Table | Type | Columns |\n|---|-------|------|--------|\n");

        int idx = 1;
        for (var table : tables) {
            var cols = metadataService.getColumns(connectionId, schema, table.name());
            md.append("| ").append(idx++).append(" | ").append(table.name())
              .append(" | ").append(table.type()).append(" | ").append(cols.size()).append(" |\n");
        }

        md.append("\n---\n\n## Table Details\n\n");

        for (var table : tables) {
            md.append("### ").append(table.name()).append("\n\n");
            var cols = metadataService.getColumns(connectionId, schema, table.name());
            var pks = metadataService.getPrimaryKeys(connectionId, schema, table.name());
            var pkNames = pks.stream().map(PrimaryKeyInfo::columnName).toList();

            md.append("| Column | Type | Size | Nullable | PK |\n|--------|------|------|----------|----|\n");
            for (var col : cols) {
                md.append("| ").append(col.name()).append(" | ").append(col.typeName())
                  .append(" | ").append(col.size()).append(" | ").append(col.nullable() ? "YES" : "NO")
                  .append(" | ").append(pkNames.contains(col.name()) ? "PK" : "").append(" |\n");
            }
            md.append("\n");
        }

        return java.util.Map.of("markdown", md.toString());
    }

    @GetMapping("/{connectionId}/schemas/{schema}/er-diagram")
    public java.util.Map<String, String> getErDiagram(@PathVariable String connectionId,
                                                       @PathVariable String schema) {
        String mermaid = metadataService.generateErDiagram(connectionId, schema);
        return java.util.Map.of("mermaid", mermaid);
    }

    @GetMapping("/{connectionId}/schemas/{schema}/er-graph")
    public java.util.Map<String, Object> getErGraph(@PathVariable String connectionId,
                                                     @PathVariable String schema) {
        return metadataService.generateErGraph(connectionId, schema);
    }

    @GetMapping("/{connectionId}/schemas/{schema}/er-export/{format}")
    public java.util.Map<String, Object> exportEr(@PathVariable String connectionId,
                                                    @PathVariable String schema,
                                                    @PathVariable String format) {
        java.util.Map<String, Object> graph = metadataService.generateErGraph(connectionId, schema);
        String content = erdExportService.export(graph, schema, format.toLowerCase());
        return java.util.Map.of(
                "format", format,
                "content", content
        );
    }

    @GetMapping("/{connectionId}/schemas/{schema}/routines")
    public List<RoutineInfo> getRoutines(@PathVariable String connectionId, @PathVariable String schema) {
        return metadataService.getRoutines(connectionId, schema);
    }

    @GetMapping("/{connectionId}/schemas/{schema}/events")
    public List<EventInfo> getEvents(@PathVariable String connectionId, @PathVariable String schema) {
        return metadataService.getEvents(connectionId, schema);
    }
}
