package com.dbee.export;

import com.dbee.model.QueryResult;

import java.io.BufferedWriter;
import java.io.IOException;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Collectors;

public class CsvExporter implements Exporter {

    @Override
    public void export(QueryResult result, Path path) throws IOException {
        try (BufferedWriter writer = Files.newBufferedWriter(path)) {
            // Header
            writer.write(String.join(",", result.getColumnNames()));
            writer.newLine();

            // Rows
            for (Object[] row : result.getRows()) {
                List<String> values = new java.util.ArrayList<>();
                for (Object val : row) {
                    values.add(escapeCsv(val));
                }
                writer.write(values.stream().collect(Collectors.joining(",")));
                writer.newLine();
            }
        }
    }

    public void export(QueryResult result, OutputStream outputStream) throws IOException {
        BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(outputStream, StandardCharsets.UTF_8));
        writer.write(String.join(",", result.getColumnNames()));
        writer.newLine();
        for (Object[] row : result.getRows()) {
            List<String> values = new java.util.ArrayList<>();
            for (Object val : row) {
                values.add(escapeCsv(val));
            }
            writer.write(values.stream().collect(Collectors.joining(",")));
            writer.newLine();
        }
        writer.flush();
    }

    @Override
    public String getFileExtension() { return "csv"; }

    @Override
    public String getDescription() { return "CSV Files"; }

    private String escapeCsv(Object value) {
        if (value == null) return "";
        String str = value.toString();
        if (str.contains(",") || str.contains("\"") || str.contains("\n")) {
            return "\"" + str.replace("\"", "\"\"") + "\"";
        }
        return str;
    }
}
