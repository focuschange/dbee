package com.dbee.controller;

import com.dbee.controller.dto.QueryRequest;
import com.dbee.export.CsvExporter;
import com.dbee.model.QueryResult;
import com.dbee.service.QueryService;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;

@RestController
@RequestMapping("/api/export")
public class ExportController {
    private final QueryService queryService;
    private final CsvExporter csvExporter;

    public ExportController(QueryService queryService) {
        this.queryService = queryService;
        this.csvExporter = new CsvExporter();
    }

    @PostMapping("/csv")
    public void exportCsv(@RequestBody QueryRequest request, HttpServletResponse response) throws IOException {
        QueryResult result = queryService.execute(
                request.connectionId(), request.sql(), request.getMaxRowsOrDefault());

        if (result.isError()) {
            response.sendError(HttpServletResponse.SC_BAD_REQUEST, result.getErrorMessage());
            return;
        }

        response.setContentType("text/csv");
        response.setHeader("Content-Disposition", "attachment; filename=\"export.csv\"");
        csvExporter.export(result, response.getOutputStream());
    }
}
