package com.dbee.model;

public record TableInfo(String name, String schema, String type) {
    @Override
    public String toString() {
        return name;
    }
}
