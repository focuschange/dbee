package com.dbee;

import com.dbee.config.ConnectionConfig;
import com.dbee.config.AppSecurityConfig;
import com.dbee.config.AuditLogConfig;
import com.dbee.config.LlmConfig;
import com.dbee.config.SavedQueryConfig;
import com.dbee.config.SnippetConfig;
import com.dbee.config.NoteConfig;
import com.dbee.config.QueryHistoryConfig;
import com.dbee.config.SshTunnelConfig;
import com.dbee.db.ConnectionManager;
import com.dbee.db.QueryExecutor;
import jakarta.annotation.PreDestroy;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

@SpringBootApplication
public class DBeeApplication {

    public static void main(String[] args) {
        SpringApplication.run(DBeeApplication.class, args);
    }

    @Bean
    public ConnectionManager connectionManager() {
        return new ConnectionManager();
    }

    @Bean
    public QueryExecutor queryExecutor() {
        return new QueryExecutor();
    }

    @Bean
    public ConnectionConfig connectionConfig() {
        return new ConnectionConfig();
    }

    @Bean
    public SshTunnelConfig sshTunnelConfig() {
        return new SshTunnelConfig();
    }

    @Bean
    public NoteConfig noteConfig() {
        return new NoteConfig();
    }

    @Bean
    public QueryHistoryConfig queryHistoryConfig() {
        return new QueryHistoryConfig();
    }

    @Bean
    public AuditLogConfig auditLogConfig() {
        return new AuditLogConfig();
    }

    @Bean
    public AppSecurityConfig appSecurityConfig() {
        return new AppSecurityConfig();
    }

    @Bean
    public LlmConfig llmConfig() {
        return new LlmConfig();
    }

    @Bean
    public SnippetConfig snippetConfig() {
        return new SnippetConfig();
    }

    @Bean
    public SavedQueryConfig savedQueryConfig() {
        return new SavedQueryConfig();
    }

    @PreDestroy
    public void cleanup() {
        connectionManager().closeAll();
        queryExecutor().shutdown();
    }
}
