package com.dbee.controller.dto;

import java.util.Map;

public record UpdateCellRequest(
        String connectionId,
        String schema,
        String table,
        Map<String, Object> primaryKeys,
        String column,
        Object value
) {
}
