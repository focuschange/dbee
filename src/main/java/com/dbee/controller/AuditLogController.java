package com.dbee.controller;

import com.dbee.config.AuditLogConfig;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/audit")
public class AuditLogController {
    private final AuditLogConfig auditLog;

    public AuditLogController(AuditLogConfig auditLog) {
        this.auditLog = auditLog;
    }

    @GetMapping
    public List<Map<String, Object>> getRecentLogs(@RequestParam(defaultValue = "100") int limit) {
        return auditLog.getRecentLogs(limit);
    }
}
