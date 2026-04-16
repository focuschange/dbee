package com.dbee.controller;

import com.dbee.controller.dto.ExplainRequest;
import com.dbee.controller.dto.QueryRequest;
import com.dbee.controller.dto.QueryResultDto;
import com.dbee.controller.dto.UpdateCellRequest;
import com.dbee.model.QueryResult;
import com.dbee.service.QueryService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/query")
public class QueryController {
    private final QueryService queryService;

    public QueryController(QueryService queryService) {
        this.queryService = queryService;
    }

    @PostMapping("/execute")
    public QueryResultDto execute(@RequestBody QueryRequest request) {
        QueryResult result = queryService.execute(
                request.connectionId(), request.sql(), request.getMaxRowsOrDefault(),
                request.executionId());
        return QueryResultDto.from(result);
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
}
