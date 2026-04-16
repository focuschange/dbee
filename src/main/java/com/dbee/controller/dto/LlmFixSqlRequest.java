package com.dbee.controller.dto;

public record LlmFixSqlRequest(String connectionId, String sql, String errorMessage) {
}
