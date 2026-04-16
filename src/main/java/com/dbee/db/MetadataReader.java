package com.dbee.db;

import com.dbee.model.*;

import java.util.List;
import java.util.Map;

public interface MetadataReader {
    List<SchemaInfo> getSchemas();
    List<TableInfo> getTables(String schema);
    List<ColumnInfo> getColumns(String schema, String table);
    List<RoutineInfo> getRoutines(String schema);
    List<EventInfo> getEvents(String schema);

    default List<PrimaryKeyInfo> getPrimaryKeys(String schema, String table) {
        return List.of();
    }

    default List<IndexInfo> getIndexes(String schema, String table) {
        return List.of();
    }

    default List<Map<String, String>> getForeignKeys(String schema, String table) {
        return List.of();
    }
}
