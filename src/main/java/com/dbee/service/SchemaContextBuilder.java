package com.dbee.service;

import com.dbee.controller.dto.AutoCompleteMetadataDto;
import com.dbee.controller.dto.AutoCompleteMetadataDto.ColumnDto;
import com.dbee.controller.dto.AutoCompleteMetadataDto.SchemaDto;
import com.dbee.controller.dto.AutoCompleteMetadataDto.TableDto;

import java.util.StringJoiner;

/**
 * Builds a compact text representation of database schema for LLM system prompts.
 */
public class SchemaContextBuilder {

    private static final String SYSTEM_PROMPT_TEMPLATE = """
            You are an expert SQL assistant. Based on the database schema provided below, \
            generate SQL queries that answer the user's question.

            Rules:
            - Return ONLY the SQL query, no explanations before or after
            - Use proper table and column names from the schema
            - Use appropriate JOINs when data spans multiple tables
            - Use aliases for readability when joining tables
            - If the question is ambiguous, make reasonable assumptions
            - If the question cannot be answered with the given schema, explain why briefly

            Database Schema:
            %s
            """;

    /**
     * Build a system prompt containing the schema context.
     */
    public static String buildSystemPrompt(AutoCompleteMetadataDto metadata) {
        String schemaText = buildSchemaText(metadata);
        return String.format(SYSTEM_PROMPT_TEMPLATE, schemaText);
    }

    /**
     * Convert metadata DTO to compact text format.
     * Format: Schema: name / Table: name (col1 TYPE, col2 TYPE, ...)
     */
    public static String buildSchemaText(AutoCompleteMetadataDto metadata) {
        if (metadata == null || metadata.schemas() == null || metadata.schemas().isEmpty()) {
            return "(No schema information available)";
        }

        StringBuilder sb = new StringBuilder();
        for (SchemaDto schema : metadata.schemas()) {
            sb.append("Schema: ").append(schema.name()).append("\n");

            if (schema.tables() == null || schema.tables().isEmpty()) {
                sb.append("  (no tables)\n");
                continue;
            }

            for (TableDto table : schema.tables()) {
                sb.append("  Table: ").append(table.name());
                if (table.columns() != null && !table.columns().isEmpty()) {
                    sb.append(" (");
                    StringJoiner colJoiner = new StringJoiner(", ");
                    for (ColumnDto col : table.columns()) {
                        colJoiner.add(col.name() + " " + col.typeName());
                    }
                    sb.append(colJoiner);
                    sb.append(")");
                }
                sb.append("\n");
            }
        }
        return sb.toString().trim();
    }
}
