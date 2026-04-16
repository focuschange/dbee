package com.dbee.controller.dto;

import java.util.Map;

public record DeleteRowRequest(String connectionId, String schema, String table, Map<String, Object> primaryKeys) {}
