package com.dbee.model;

public record RoutineInfo(String name, String schema, String type, String returnType) {
    @Override
    public String toString() {
        return name + " (" + type + ")";
    }
}
