package com.dbee.controller.dto;

import java.util.List;

public record AutoCompleteMetadataDto(List<SchemaDto> schemas) {

    public record SchemaDto(String name, List<TableDto> tables) {}

    public record TableDto(String name, String type, List<ColumnDto> columns) {}

    public record ColumnDto(String name, String typeName) {}
}
