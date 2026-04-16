package com.dbee.model;

public record IndexInfo(String name, String columnName, boolean unique, int ordinal, String type) {}
