package com.dbee.model;

public record ColumnInfo(String name, String typeName, int size, boolean nullable) {
    @Override
    public String toString() {
        return name + " (" + typeName + ")";
    }
}
