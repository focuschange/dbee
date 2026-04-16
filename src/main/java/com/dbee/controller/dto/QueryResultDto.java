package com.dbee.controller.dto;

import com.dbee.model.QueryResult;

import java.util.ArrayList;
import java.util.List;

public record QueryResultDto(
        boolean error,
        boolean select,
        String errorMessage,
        List<String> columnNames,
        List<String> columnTypeNames,
        List<List<Object>> rows,
        int affectedRows,
        long executionTimeMs,
        String tableName,
        String schemaName
) {
    public static QueryResultDto from(QueryResult result) {
        List<List<Object>> rows = new ArrayList<>();
        for (Object[] row : result.getRows()) {
            List<Object> list = new ArrayList<>(row.length);
            for (Object val : row) {
                list.add(val != null ? convertValue(val) : null);
            }
            rows.add(list);
        }

        return new QueryResultDto(
                result.isError(),
                result.isSelect(),
                result.getErrorMessage(),
                result.getColumnNames(),
                result.getColumnTypeNames(),
                rows,
                result.getAffectedRows(),
                result.getExecutionTimeMs(),
                result.getTableName(),
                result.getSchemaName()
        );
    }

    private static Object convertValue(Object val) {
        if (val instanceof java.sql.Timestamp ts) return ts.toString();
        if (val instanceof java.sql.Date d) return d.toString();
        if (val instanceof java.sql.Time t) return t.toString();
        if (val instanceof byte[]) return "[BINARY]";
        return val;
    }
}
