package com.dbee.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public class SavedQueryInfo {
    private String id;
    private String name;
    private String sql;
    private String folder;
    private long createdAt;
    private long updatedAt;

    public SavedQueryInfo() {
        this.id = UUID.randomUUID().toString();
        this.createdAt = System.currentTimeMillis();
        this.updatedAt = this.createdAt;
        this.folder = "";
    }

    public SavedQueryInfo(String name, String sql) {
        this();
        this.name = name;
        this.sql = sql;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getSql() { return sql; }
    public void setSql(String sql) { this.sql = sql; }
    public String getFolder() { return folder; }
    public void setFolder(String folder) { this.folder = folder; }
    public long getCreatedAt() { return createdAt; }
    public void setCreatedAt(long createdAt) { this.createdAt = createdAt; }
    public long getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(long updatedAt) { this.updatedAt = updatedAt; }
}
