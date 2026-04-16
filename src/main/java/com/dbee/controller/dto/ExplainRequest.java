package com.dbee.controller.dto;

public record ExplainRequest(String connectionId, String sql, boolean analyze) {
}
