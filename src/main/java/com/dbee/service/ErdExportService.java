package com.dbee.service;

import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * Converts an ER graph (nodes + edges) to various text formats:
 * mermaid, dbml, ddl, plantuml.
 * PNG/SVG/JSON are handled on the frontend via Cytoscape.
 */
@Service
public class ErdExportService {

    // Types that benefit from showing size: CHAR/VARCHAR/BINARY/TEXT/DECIMAL/NUMERIC/FLOAT/DOUBLE
    private static final java.util.regex.Pattern SIZED_TYPE =
            java.util.regex.Pattern.compile(
                "^(CHAR|VARCHAR|BINARY|VARBINARY|TEXT|TINYTEXT|MEDIUMTEXT|LONGTEXT|" +
                "DECIMAL|NUMERIC|FLOAT|DOUBLE|NCHAR|NVARCHAR|NTEXT|BIT|STRING)$",
                java.util.regex.Pattern.CASE_INSENSITIVE);

    /** Formats type with size when appropriate: VARCHAR + 255 -> VARCHAR(255). */
    static String formatType(Object typeObj, Object sizeObj) {
        if (typeObj == null) return "UNKNOWN";
        String type = String.valueOf(typeObj);
        if (sizeObj == null) return type;
        int size;
        try { size = ((Number) sizeObj).intValue(); } catch (Exception e) { return type; }
        if (size <= 0) return type;
        String bare = type.replaceAll("[\\s()].*$", "");
        if (SIZED_TYPE.matcher(bare).matches()) {
            // Cap absurdly large sizes (e.g., TEXT reported as 2GB)
            if (size > 65535) return type;
            return bare + "(" + size + ")";
        }
        return type;
    }

    public String export(Map<String, Object> graph, String schema, String format) {
        return switch (format) {
            case "mermaid" -> toMermaid(graph);
            case "dbml" -> toDbml(graph);
            case "ddl" -> toDdl(graph);
            case "plantuml" -> toPlantUml(graph);
            default -> throw new IllegalArgumentException("Unsupported format: " + format);
        };
    }

    @SuppressWarnings("unchecked")
    private String toMermaid(Map<String, Object> graph) {
        StringBuilder sb = new StringBuilder("erDiagram\n");
        List<Map<String, Object>> nodes = (List<Map<String, Object>>) graph.getOrDefault("nodes", List.of());
        List<Map<String, Object>> edges = (List<Map<String, Object>>) graph.getOrDefault("edges", List.of());

        for (Map<String, Object> node : nodes) {
            String name = String.valueOf(node.get("id"));
            sb.append("    ").append(name).append(" {\n");
            List<Map<String, Object>> cols = (List<Map<String, Object>>) node.getOrDefault("columns", List.of());
            for (Map<String, Object> col : cols) {
                String type = formatType(col.get("type"), col.get("size")).replaceAll("[\\s()]", "_");
                String cname = String.valueOf(col.get("name"));
                boolean pk = Boolean.TRUE.equals(col.get("pk"));
                boolean fk = Boolean.TRUE.equals(col.get("fk"));
                String mark = pk ? " PK" : (fk ? " FK" : "");
                sb.append("        ").append(type).append(" ").append(cname).append(mark).append("\n");
            }
            sb.append("    }\n");
        }

        for (Map<String, Object> edge : edges) {
            sb.append("    ").append(edge.get("target"))
              .append(" ||--o{ ").append(edge.get("source"))
              .append(" : \"").append(edge.get("label")).append("\"\n");
        }
        return sb.toString();
    }

    @SuppressWarnings("unchecked")
    private String toDbml(Map<String, Object> graph) {
        StringBuilder sb = new StringBuilder();
        List<Map<String, Object>> nodes = (List<Map<String, Object>>) graph.getOrDefault("nodes", List.of());
        List<Map<String, Object>> edges = (List<Map<String, Object>>) graph.getOrDefault("edges", List.of());

        for (Map<String, Object> node : nodes) {
            String name = String.valueOf(node.get("id"));
            sb.append("Table ").append(name).append(" {\n");
            List<Map<String, Object>> cols = (List<Map<String, Object>>) node.getOrDefault("columns", List.of());
            for (Map<String, Object> col : cols) {
                String cname = String.valueOf(col.get("name"));
                String type = formatType(col.get("type"), col.get("size")).toLowerCase();
                boolean pk = Boolean.TRUE.equals(col.get("pk"));
                Boolean nullable = (Boolean) col.get("nullable");
                List<String> modifiers = new java.util.ArrayList<>();
                if (pk) modifiers.add("pk");
                if (Boolean.FALSE.equals(nullable)) modifiers.add("not null");
                String mods = modifiers.isEmpty() ? "" : " [" + String.join(", ", modifiers) + "]";
                sb.append("  ").append(cname).append(" ").append(type).append(mods).append("\n");
            }
            sb.append("}\n\n");
        }

        for (Map<String, Object> edge : edges) {
            sb.append("Ref: ").append(edge.get("source")).append(".").append(edge.get("fkColumn"))
              .append(" > ").append(edge.get("target")).append(".").append(edge.get("pkColumn"))
              .append("\n");
        }
        return sb.toString();
    }

    @SuppressWarnings("unchecked")
    private String toDdl(Map<String, Object> graph) {
        StringBuilder sb = new StringBuilder("-- DDL exported from DBee ERD\n\n");
        List<Map<String, Object>> nodes = (List<Map<String, Object>>) graph.getOrDefault("nodes", List.of());
        List<Map<String, Object>> edges = (List<Map<String, Object>>) graph.getOrDefault("edges", List.of());

        for (Map<String, Object> node : nodes) {
            String name = String.valueOf(node.get("id"));
            sb.append("CREATE TABLE ").append(name).append(" (\n");
            List<Map<String, Object>> cols = (List<Map<String, Object>>) node.getOrDefault("columns", List.of());
            List<String> pkCols = new java.util.ArrayList<>();
            for (int i = 0; i < cols.size(); i++) {
                Map<String, Object> col = cols.get(i);
                String cname = String.valueOf(col.get("name"));
                String type = formatType(col.get("type"), col.get("size"));
                boolean nullable = !Boolean.FALSE.equals(col.get("nullable"));
                if (Boolean.TRUE.equals(col.get("pk"))) pkCols.add(cname);
                sb.append("  ").append(cname).append(" ").append(type);
                if (!nullable) sb.append(" NOT NULL");
                if (i < cols.size() - 1 || !pkCols.isEmpty()) sb.append(",");
                sb.append("\n");
            }
            if (!pkCols.isEmpty()) {
                sb.append("  PRIMARY KEY (").append(String.join(", ", pkCols)).append(")\n");
            }
            sb.append(");\n\n");
        }

        for (Map<String, Object> edge : edges) {
            String source = String.valueOf(edge.get("source"));
            sb.append("ALTER TABLE ").append(source)
              .append(" ADD FOREIGN KEY (").append(edge.get("fkColumn")).append(")")
              .append(" REFERENCES ").append(edge.get("target"))
              .append(" (").append(edge.get("pkColumn")).append(");\n");
        }
        return sb.toString();
    }

    @SuppressWarnings("unchecked")
    private String toPlantUml(Map<String, Object> graph) {
        StringBuilder sb = new StringBuilder("@startuml\n");
        sb.append("!define Table(x) entity x\n");
        sb.append("hide methods\n");
        sb.append("hide stereotypes\n\n");
        List<Map<String, Object>> nodes = (List<Map<String, Object>>) graph.getOrDefault("nodes", List.of());
        List<Map<String, Object>> edges = (List<Map<String, Object>>) graph.getOrDefault("edges", List.of());

        for (Map<String, Object> node : nodes) {
            String name = String.valueOf(node.get("id"));
            sb.append("entity ").append(name).append(" {\n");
            List<Map<String, Object>> cols = (List<Map<String, Object>>) node.getOrDefault("columns", List.of());
            for (Map<String, Object> col : cols) {
                String cname = String.valueOf(col.get("name"));
                String type = formatType(col.get("type"), col.get("size"));
                boolean pk = Boolean.TRUE.equals(col.get("pk"));
                boolean fk = Boolean.TRUE.equals(col.get("fk"));
                String prefix = pk ? "* " : (fk ? "+ " : "  ");
                sb.append("  ").append(prefix).append(cname).append(" : ").append(type).append("\n");
            }
            sb.append("}\n\n");
        }

        for (Map<String, Object> edge : edges) {
            sb.append(edge.get("target")).append(" ||--o{ ").append(edge.get("source"))
              .append(" : \"").append(edge.get("label")).append("\"\n");
        }
        sb.append("@enduml\n");
        return sb.toString();
    }
}
