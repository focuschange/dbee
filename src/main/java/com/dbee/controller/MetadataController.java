package com.dbee.controller;

import com.dbee.controller.dto.AutoCompleteMetadataDto;
import com.dbee.model.*;
import com.dbee.service.MetadataService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/metadata")
public class MetadataController {
    private final MetadataService metadataService;

    public MetadataController(MetadataService metadataService) {
        this.metadataService = metadataService;
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

    @GetMapping("/{connectionId}/schemas/{schema}/routines")
    public List<RoutineInfo> getRoutines(@PathVariable String connectionId, @PathVariable String schema) {
        return metadataService.getRoutines(connectionId, schema);
    }

    @GetMapping("/{connectionId}/schemas/{schema}/events")
    public List<EventInfo> getEvents(@PathVariable String connectionId, @PathVariable String schema) {
        return metadataService.getEvents(connectionId, schema);
    }
}
