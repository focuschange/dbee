package com.dbee.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public class SshTunnelInfo {
    private String id;
    private String name;
    private String host;
    private int port;
    private String username;
    private String authType; // "password" or "key"
    private String password;
    private String keyPath;
    private String keyPassphrase;

    public SshTunnelInfo() {
        this.id = UUID.randomUUID().toString();
        this.port = 22;
        this.authType = "password";
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getHost() { return host; }
    public void setHost(String host) { this.host = host; }

    public int getPort() { return port; }
    public void setPort(int port) { this.port = port; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getAuthType() { return authType; }
    public void setAuthType(String authType) { this.authType = authType; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getKeyPath() { return keyPath; }
    public void setKeyPath(String keyPath) { this.keyPath = keyPath; }

    public String getKeyPassphrase() { return keyPassphrase; }
    public void setKeyPassphrase(String keyPassphrase) { this.keyPassphrase = keyPassphrase; }

    @Override
    public String toString() {
        return name != null ? name : username + "@" + host;
    }
}
