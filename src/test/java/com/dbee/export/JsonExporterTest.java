package com.dbee.export;

import com.dbee.model.QueryResult;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class JsonExporterTest {

    @Test
    void exportsJsonArray() throws IOException {
        List<Class<?>> types = new ArrayList<>();
        types.add(Integer.class);
        types.add(String.class);
        List<Object[]> rows = new ArrayList<>();
        rows.add(new Object[]{1, "Alice"});
        QueryResult result = QueryResult.ofSelect(
                List.of("id", "name"), types, List.of("INT", "VARCHAR"), rows, 50, null, null);

        JsonExporter exporter = new JsonExporter();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        exporter.export(result, out);

        String json = out.toString();
        assertTrue(json.contains("\"id\""));
        assertTrue(json.contains("\"Alice\""));
    }
}
