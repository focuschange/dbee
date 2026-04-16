package com.dbee.model;

public record EventInfo(String name, String schema, String status) {
    @Override
    public String toString() {
        return name;
    }
}
