package com.dbee.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public class ConnectionInfo {
    private String id;
    private String name;
    private DatabaseType databaseType;
    private String host;
    private int port;
    private String database;
    private String username;
    private String password;
    private Map<String, String> properties;

    public ConnectionInfo() {
        this.id = UUID.randomUUID().toString();
        this.properties = new HashMap<>();
    }

    public ConnectionInfo(String name, DatabaseType databaseType, String host, int port,
                          String database, String username, String password) {
        this();
        this.name = name;
        this.databaseType = databaseType;
        this.host = host;
        this.port = port;
        this.database = database;
        this.username = username;
        this.password = password;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public DatabaseType getDatabaseType() { return databaseType; }
    public void setDatabaseType(DatabaseType databaseType) { this.databaseType = databaseType; }

    public String getHost() { return host; }
    public void setHost(String host) { this.host = host; }

    public int getPort() { return port; }
    public void setPort(int port) { this.port = port; }

    public String getDatabase() { return database; }
    public void setDatabase(String database) { this.database = database; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public Map<String, String> getProperties() { return properties; }
    public void setProperties(Map<String, String> properties) { this.properties = properties; }

    @Override
    public String toString() {
        return name != null ? name : databaseType + " Connection";
    }
}
