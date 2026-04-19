package com.dbee.controller;

import com.dbee.db.apm.ApmQueries;
import com.dbee.db.apm.ServerSession;
import com.dbee.service.ApmService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * #139 Phase C — endpoints backing the Sessions tab's Server Sessions
 * section, shared with future APM tab features.
 */
@RestController
@RequestMapping("/api/apm")
public class ApmController {
    private static final Logger log = LoggerFactory.getLogger(ApmController.class);

    private final ApmService apmService;

    public ApmController(ApmService apmService) {
        this.apmService = apmService;
    }

    @GetMapping("/{connId}/sessions")
    public Map<String, Object> sessions(@PathVariable String connId,
                                        @RequestParam(defaultValue = "10") int limit) {
        try {
            ApmQueries q = apmService.forConnection(connId);
            if (!q.isSupported()) {
                return Map.of("supported", false, "sessions", List.of());
            }
            List<ServerSession> list = apmService.listSessions(connId, limit);
            return Map.of("supported", true, "sessions", list);
        } catch (Exception e) {
            log.warn("Sessions fetch failed for {}: {}", connId, e.getMessage());
            return Map.of(
                    "supported", true,
                    "sessions", List.of(),
                    "error", e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage()
            );
        }
    }

    @PostMapping("/{connId}/sessions/{sessionId}/kill")
    public Map<String, Object> kill(@PathVariable String connId, @PathVariable String sessionId) {
        try {
            apmService.killSession(connId, sessionId);
            return Map.of("success", true, "message", "Session " + sessionId + " terminated");
        } catch (UnsupportedOperationException e) {
            return Map.of("success", false, "message", e.getMessage());
        } catch (Exception e) {
            String msg = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
            if (msg.toLowerCase().contains("permission") || msg.toLowerCase().contains("privilege")
                    || msg.toLowerCase().contains("denied")) {
                msg = "Permission denied — the connection user lacks kill/terminate privileges";
            }
            return Map.of("success", false, "message", msg);
        }
    }
}
