package com.dbee.export;

import com.dbee.model.QueryResult;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Path;
import java.util.*;

public class JsonExporter implements Exporter {
    private final ObjectMapper mapper = new ObjectMapper().enable(SerializationFeature.INDENT_OUTPUT);

    @Override
    public void export(QueryResult result, Path path) throws IOException {
        mapper.writeValue(path.toFile(), buildData(result));
    }

    public void export(QueryResult result, OutputStream out) throws IOException {
        mapper.writeValue(out, buildData(result));
    }

    private List<Map<String, Object>> buildData(QueryResult result) {
        List<Map<String, Object>> data = new ArrayList<>();
        List<String> cols = result.getColumnNames();
        for (Object[] row : result.getRows()) {
            Map<String, Object> map = new LinkedHashMap<>();
            for (int i = 0; i < cols.size(); i++) {
                Object val = i < row.length ? row[i] : null;
                map.put(cols.get(i), val != null ? convertValue(val) : null);
            }
            data.add(map);
        }
        return data;
    }

    private Object convertValue(Object val) {
        if (val instanceof java.sql.Timestamp ts) return ts.toString();
        if (val instanceof java.sql.Date d) return d.toString();
        if (val instanceof java.sql.Time t) return t.toString();
        if (val instanceof byte[]) return "[BINARY]";
        return val;
    }

    @Override public String getFileExtension() { return "json"; }
    @Override public String getDescription() { return "JSON Files"; }
}
