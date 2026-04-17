package com.dbee.controller;

import com.dbee.controller.dto.ExplainRequest;
import com.dbee.controller.dto.QueryRequest;
import com.dbee.controller.dto.QueryResultDto;
import com.dbee.controller.dto.DeleteRowRequest;
import com.dbee.controller.dto.InsertRowRequest;
import com.dbee.controller.dto.UpdateCellRequest;
import com.dbee.model.QueryResult;
import com.dbee.service.QueryService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/query")
public class QueryController {
    private final QueryService queryService;

    public QueryController(QueryService queryService) {
        this.queryService = queryService;
    }

    @PostMapping("/execute")
    public List<QueryResultDto> execute(@RequestBody QueryRequest request) {
        String[] statements = splitStatements(request.sql());
        List<QueryResultDto> results = new ArrayList<>();

        for (int i = 0; i < statements.length; i++) {
            String sql = statements[i].trim();
            if (sql.isEmpty()) continue;
            String execId = request.executionId() != null
                    ? request.executionId() + "-" + i : null;
            QueryResult result = queryService.execute(
                    request.connectionId(), sql, request.getMaxRowsOrDefault(), execId);
            results.add(QueryResultDto.from(result));
            // Stop on error
            if (result.isError()) break;
        }

        return results;
    }

    /**
     * Split SQL by semicolons, respecting string literals.
     */
    private String[] splitStatements(String sql) {
        if (sql == null) return new String[0];
        List<String> stmts = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean inSingleQuote = false;
        boolean inDoubleQuote = false;
        boolean inLineComment = false;
        boolean inBlockComment = false;

        for (int i = 0; i < sql.length(); i++) {
            char c = sql.charAt(i);
            char next = i + 1 < sql.length() ? sql.charAt(i + 1) : 0;

            if (inLineComment) {
                current.append(c);
                if (c == '\n') inLineComment = false;
                continue;
            }
            if (inBlockComment) {
                current.append(c);
                if (c == '*' && next == '/') { current.append('/'); i++; inBlockComment = false; }
                continue;
            }
            if (inSingleQuote) {
                current.append(c);
                if (c == '\'' && next == '\'') { current.append('\''); i++; }
                else if (c == '\'') inSingleQuote = false;
                continue;
            }
            if (inDoubleQuote) {
                current.append(c);
                if (c == '"') inDoubleQuote = false;
                continue;
            }

            if (c == '\'') { inSingleQuote = true; current.append(c); continue; }
            if (c == '"') { inDoubleQuote = true; current.append(c); continue; }
            if (c == '-' && next == '-') { inLineComment = true; current.append(c); continue; }
            if (c == '/' && next == '*') { inBlockComment = true; current.append(c); continue; }

            if (c == ';') {
                String stmt = current.toString().trim();
                if (!stmt.isEmpty()) stmts.add(stmt);
                current.setLength(0);
            } else {
                current.append(c);
            }
        }

        String last = current.toString().trim();
        if (!last.isEmpty()) stmts.add(last);

        return stmts.toArray(new String[0]);
    }

    @PostMapping("/cancel/{executionId}")
    public java.util.Map<String, Object> cancel(@org.springframework.web.bind.annotation.PathVariable String executionId) {
        boolean cancelled = queryService.cancelQuery(executionId);
        return java.util.Map.of("cancelled", cancelled);
    }

    @PostMapping("/explain")
    public QueryResultDto explain(@RequestBody ExplainRequest request) {
        QueryResult result = queryService.explain(
                request.connectionId(), request.sql(), request.analyze());
        return QueryResultDto.from(result);
    }

    @PostMapping("/update-cell")
    public QueryResultDto updateCell(@RequestBody UpdateCellRequest request) {
        QueryResult result = queryService.updateCell(
                request.connectionId(), request.schema(), request.table(),
                request.primaryKeys(), request.column(), request.value());
        return QueryResultDto.from(result);
    }

    @PostMapping("/delete-row")
    public QueryResultDto deleteRow(@RequestBody DeleteRowRequest request) {
        QueryResult result = queryService.deleteRow(
                request.connectionId(), request.schema(), request.table(), request.primaryKeys());
        return QueryResultDto.from(result);
    }

    @PostMapping("/insert-row")
    public QueryResultDto insertRow(@RequestBody InsertRowRequest request) {
        QueryResult result = queryService.insertRow(
                request.connectionId(), request.schema(), request.table(), request.values());
        return QueryResultDto.from(result);
    }
}
