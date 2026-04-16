package com.dbee.controller.dto;

public record QueryRequest(String connectionId, String sql, Integer maxRows) {
    public int getMaxRowsOrDefault() {
        return maxRows != null && maxRows > 0 ? maxRows : 1000;
    }
}
