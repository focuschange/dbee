package com.dbee.db;

import com.dbee.model.*;

import java.util.List;

public interface MetadataReader {
    List<SchemaInfo> getSchemas();
    List<TableInfo> getTables(String schema);
    List<ColumnInfo> getColumns(String schema, String table);
    List<RoutineInfo> getRoutines(String schema);
    List<EventInfo> getEvents(String schema);

    default List<PrimaryKeyInfo> getPrimaryKeys(String schema, String table) {
        return List.of();
    }
}
