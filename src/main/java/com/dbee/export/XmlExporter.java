package com.dbee.export;

import com.dbee.model.QueryResult;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

public class XmlExporter implements Exporter {

    @Override
    public void export(QueryResult result, Path path) throws IOException {
        try (BufferedWriter w = Files.newBufferedWriter(path)) {
            writeXml(result, w);
        }
    }

    public void export(QueryResult result, OutputStream out) throws IOException {
        BufferedWriter w = new BufferedWriter(new OutputStreamWriter(out, StandardCharsets.UTF_8));
        writeXml(result, w);
        w.flush();
    }

    private void writeXml(QueryResult result, BufferedWriter w) throws IOException {
        List<String> cols = result.getColumnNames();
        w.write("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        w.write("<resultset>\n");

        for (Object[] row : result.getRows()) {
            w.write("  <row>\n");
            for (int i = 0; i < cols.size(); i++) {
                String colName = sanitizeTag(cols.get(i));
                Object val = i < row.length ? row[i] : null;
                if (val == null) {
                    w.write("    <" + colName + " xsi:nil=\"true\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"/>\n");
                } else {
                    w.write("    <" + colName + ">" + escapeXml(formatValue(val)) + "</" + colName + ">\n");
                }
            }
            w.write("  </row>\n");
        }

        w.write("</resultset>\n");
    }

    private String formatValue(Object val) {
        if (val instanceof java.sql.Timestamp ts) return ts.toString();
        if (val instanceof java.sql.Date d) return d.toString();
        if (val instanceof byte[]) return "[BINARY]";
        return val.toString();
    }

    private String escapeXml(String s) {
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&apos;");
    }

    private String sanitizeTag(String name) {
        return name.replaceAll("[^a-zA-Z0-9_]", "_");
    }

    @Override public String getFileExtension() { return "xml"; }
    @Override public String getDescription() { return "XML Files"; }
}
