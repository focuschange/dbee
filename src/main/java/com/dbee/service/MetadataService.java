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
