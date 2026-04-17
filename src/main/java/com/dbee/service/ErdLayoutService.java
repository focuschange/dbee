package com.dbee.service;

import com.dbee.config.ErdLayoutConfig;
import com.dbee.model.ErdLayout;
import org.springframework.stereotype.Service;

@Service
public class ErdLayoutService {
    private final ErdLayoutConfig config;

    public ErdLayoutService(ErdLayoutConfig config) {
        this.config = config;
    }

    public ErdLayout getLayout(String connectionId, String schema) {
        return config.load(connectionId, schema);
    }

    public void saveLayout(String connectionId, String schema, ErdLayout layout) {
        config.save(connectionId, schema, layout);
    }

    public void deleteLayout(String connectionId, String schema) {
        config.delete(connectionId, schema);
    }

    public void deleteAllForConnection(String connectionId) {
        config.deleteAllForConnection(connectionId);
    }
}
