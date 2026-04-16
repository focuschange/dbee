package com.dbee.model;

public record SchemaInfo(String name, String catalog) {
    @Override
    public String toString() {
        return name;
    }
}
