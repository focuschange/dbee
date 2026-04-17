package com.dbee.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Set;

/**
 * Enforces PIN authentication on all /api/ endpoints when PIN is enabled.
 * Static resources and the security/verify endpoint are excluded.
 */
public class SecurityFilter extends OncePerRequestFilter {
    private final AppSecurityConfig securityConfig;

    // Endpoints that don't require authentication
    private static final Set<String> PUBLIC_PATHS = Set.of(
            "/api/security/status",
            "/api/security/verify",
            "/api/version",
            "/api/connections/password-reentry-required"
    );

    public SecurityFilter(AppSecurityConfig securityConfig) {
        this.securityConfig = securityConfig;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                     FilterChain filterChain) throws ServletException, IOException {
        String path = request.getRequestURI();

        // Skip non-API paths (static resources, index.html)
        if (!path.startsWith("/api/")) {
            filterChain.doFilter(request, response);
            return;
        }

        // Skip public endpoints
        if (PUBLIC_PATHS.contains(path)) {
            filterChain.doFilter(request, response);
            return;
        }

        // If PIN is not enabled, allow all
        if (!securityConfig.isEnabled()) {
            filterChain.doFilter(request, response);
            return;
        }

        // Check session for authenticated flag
        var session = request.getSession(false);
        if (session != null && Boolean.TRUE.equals(session.getAttribute("dbee-authenticated"))) {
            filterChain.doFilter(request, response);
            return;
        }

        // Reject with 401
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json");
        response.getWriter().write("{\"error\":\"Authentication required. Please enter your PIN.\"}");
    }
}
