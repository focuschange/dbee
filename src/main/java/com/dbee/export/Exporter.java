package com.dbee.export;

import com.dbee.model.QueryResult;

import java.io.IOException;
import java.nio.file.Path;

public interface Exporter {
    void export(QueryResult result, Path path) throws IOException;
    String getFileExtension();
    String getDescription();
}
