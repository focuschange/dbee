package com.dbee.export;

import com.dbee.model.QueryResult;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class CsvExporterTest {

    private QueryResult makeResult() {
        List<String> cols = List.of("id", "name");
        List<Class<?>> types = new ArrayList<>();
        types.add(Integer.class);
        types.add(String.class);
        List<String> typeNames = List.of("INT", "VARCHAR");
        List<Object[]> rows = new ArrayList<>();
        rows.add(new Object[]{1, "Alice"});
        rows.add(new Object[]{2, "Bob"});
        return QueryResult.ofSelect(cols, types, typeNames, rows, 100, null, null);
    }

    @Test
    void exportsCsvCorrectly() throws IOException {
        CsvExporter exporter = new CsvExporter();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        exporter.export(makeResult(), out);

        String csv = out.toString();
        assertTrue(csv.contains("id,name"));
        assertTrue(csv.contains("1,Alice"));
        assertTrue(csv.contains("2,Bob"));
    }

    @Test
    void handlesNullValues() throws IOException {
        List<Class<?>> types = new ArrayList<>();
        types.add(String.class);
        List<Object[]> rows = new ArrayList<>();
        rows.add(new Object[]{null});
        QueryResult result = QueryResult.ofSelect(List.of("col1"), types, List.of("VARCHAR"), rows, 10, null, null);

        CsvExporter exporter = new CsvExporter();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        exporter.export(result, out);
        assertTrue(out.toString().contains("col1"));
    }
}
