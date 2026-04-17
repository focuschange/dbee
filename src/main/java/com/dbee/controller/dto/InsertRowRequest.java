package com.dbee.controller.dto;

import java.util.Map;

public record InsertRowRequest(String connectionId, String schema, String table, Map<String, Object> values) {}
