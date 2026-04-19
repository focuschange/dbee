package com.dbee.controller;

import com.dbee.controller.dto.QueryRequest;
import com.dbee.export.CsvExporter;
import com.dbee.export.InsertExporter;
import com.dbee.export.JsonExporter;
import com.dbee.export.XlsxExporter;
import com.dbee.export.XmlExporter;
import com.dbee.model.QueryResult;
import com.dbee.service.QueryService;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;

@RestController
@RequestMapping("/api/export")
public class ExportController {
    private final QueryService queryService;
    private final CsvExporter csvExporter;
    private final JsonExporter jsonExporter;
    private final XlsxExporter xlsxExporter;
    private final XmlExporter xmlExporter;

    public ExportController(QueryService queryService) {
        this.queryService = queryService;
        this.csvExporter = new CsvExporter();
        this.jsonExporter = new JsonExporter();
        this.xlsxExporter = new XlsxExporter();
        this.xmlExporter = new XmlExporter();
    }

    @PostMapping("/csv")
    public void exportCsv(@RequestBody QueryRequest request, HttpServletResponse response) throws IOException {
        QueryResult result = executeForExport(request);
        if (result.isError()) { writeError(response, result.getErrorMessage()); return; }
        response.setContentType("text/csv");
        response.setHeader("Content-Disposition", "attachment; filename=\"export.csv\"");
        csvExporter.export(result, response.getOutputStream());
    }

    @PostMapping("/json")
    public void exportJson(@RequestBody QueryRequest request, HttpServletResponse response) throws IOException {
        QueryResult result = executeForExport(request);
        if (result.isError()) { writeError(response, result.getErrorMessage()); return; }
        response.setContentType("application/json");
        response.setHeader("Content-Disposition", "attachment; filename=\"export.json\"");
        jsonExporter.export(result, response.getOutputStream());
    }

    @PostMapping("/insert")
    public void exportInsert(@RequestBody QueryRequest request,
                             @RequestParam(defaultValue = "my_table") String tableName,
                             HttpServletResponse response) throws IOException {
        QueryResult result = executeForExport(request);
        if (result.isError()) { writeError(response, result.getErrorMessage()); return; }
        response.setContentType("text/plain");
        response.setHeader("Content-Disposition", "attachment; filename=\"export.sql\"");
        new InsertExporter(tableName).export(result, response.getOutputStream());
    }

    @PostMapping("/xlsx")
    public void exportXlsx(@RequestBody QueryRequest request, HttpServletResponse response) throws IOException {
        QueryResult result = executeForExport(request);
        if (result.isError()) { writeError(response, result.getErrorMessage()); return; }
        response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        response.setHeader("Content-Disposition", "attachment; filename=\"export.xlsx\"");
        xlsxExporter.export(result, response.getOutputStream());
    }

    @PostMapping("/xml")
    public void exportXml(@RequestBody QueryRequest request, HttpServletResponse response) throws IOException {
        QueryResult result = executeForExport(request);
        if (result.isError()) { writeError(response, result.getErrorMessage()); return; }
        response.setContentType("application/xml");
        response.setHeader("Content-Disposition", "attachment; filename=\"export.xml\"");
        xmlExporter.export(result, response.getOutputStream());
    }

    private QueryResult executeForExport(QueryRequest request) {
        return queryService.execute(request.connectionId(), request.sql(), request.getMaxRowsOrDefault());
    }

    private void writeError(HttpServletResponse response, String msg) throws IOException {
        response.setStatus(400);
        response.setContentType("text/plain; charset=utf-8");
        response.getWriter().write(msg != null ? msg : "Export failed");
    }
}
