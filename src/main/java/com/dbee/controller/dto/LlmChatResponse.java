package com.dbee.controller.dto;

public record LlmChatResponse(String message, String sql, boolean error) {
    public static LlmChatResponse success(String message, String sql) {
        return new LlmChatResponse(message, sql, false);
    }

    public static LlmChatResponse error(String message) {
        return new LlmChatResponse(message, null, true);
    }
}
