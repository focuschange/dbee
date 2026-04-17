package com.dbee.export;

import com.dbee.model.QueryResult;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

public class InsertExporter implements Exporter {
    private final String tableName;

    public InsertExporter(String tableName) {
        this.tableName = tableName != null && !tableName.isBlank() ? tableName : "my_table";
    }

    @Override
    public void export(QueryResult result, Path path) throws IOException {
        try (BufferedWriter w = Files.newBufferedWriter(path)) {
            writeInserts(result, w);
        }
    }

    public void export(QueryResult result, OutputStream out) throws IOException {
        BufferedWriter w = new BufferedWriter(new OutputStreamWriter(out, StandardCharsets.UTF_8));
        writeInserts(result, w);
        w.flush();
    }

    private void writeInserts(QueryResult result, BufferedWriter w) throws IOException {
        List<String> cols = result.getColumnNames();
        String colList = String.join(", ", cols.stream().map(c -> "`" + c + "`").toList());

        for (Object[] row : result.getRows()) {
            w.write("INSERT INTO `" + tableName + "` (" + colList + ") VALUES (");
            for (int i = 0; i < row.length; i++) {
                if (i > 0) w.write(", ");
                w.write(formatValue(row[i]));
            }
            w.write(");");
            w.newLine();
        }
    }

    private String formatValue(Object val) {
        if (val == null) return "NULL";
        if (val instanceof Number) return val.toString();
        if (val instanceof Boolean b) return b ? "1" : "0";
        if (val instanceof byte[]) return "NULL"; // skip binary
        String str = val.toString().replace("'", "''");
        return "'" + str + "'";
    }

    @Override public String getFileExtension() { return "sql"; }
    @Override public String getDescription() { return "SQL INSERT Statements"; }
}
