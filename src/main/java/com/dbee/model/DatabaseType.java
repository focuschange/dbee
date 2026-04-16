package com.dbee.model;

public enum DatabaseType {
    MYSQL("MySQL", "com.mysql.cj.jdbc.Driver", 3306,
            "jdbc:mysql://{host}:{port}/{database}"),
    POSTGRESQL("PostgreSQL", "org.postgresql.Driver", 5432,
            "jdbc:postgresql://{host}:{port}/{database}"),
    ORACLE("Oracle", "oracle.jdbc.OracleDriver", 1521,
            "jdbc:oracle:thin:@{host}:{port}:{database}"),
    SQLITE("SQLite", "org.sqlite.JDBC", 0,
            "jdbc:sqlite:{database}"),
    MSSQL("SQL Server", "com.microsoft.sqlserver.jdbc.SQLServerDriver", 1433,
            "jdbc:sqlserver://{host}:{port};databaseName={database};encrypt=false"),
    ATHENA("Amazon Athena", "com.simba.athena.jdbc.Driver", 443,
            "jdbc:awsathena://AwsRegion={region};S3OutputLocation={s3Output}");

    private final String displayName;
    private final String driverClass;
    private final int defaultPort;
    private final String jdbcUrlTemplate;

    DatabaseType(String displayName, String driverClass, int defaultPort, String jdbcUrlTemplate) {
        this.displayName = displayName;
        this.driverClass = driverClass;
        this.defaultPort = defaultPort;
        this.jdbcUrlTemplate = jdbcUrlTemplate;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getDriverClass() {
        return driverClass;
    }

    public int getDefaultPort() {
        return defaultPort;
    }

    public String buildJdbcUrl(ConnectionInfo info) {
        return jdbcUrlTemplate
                .replace("{host}", info.getHost() != null ? info.getHost() : "localhost")
                .replace("{port}", String.valueOf(info.getPort() > 0 ? info.getPort() : defaultPort))
                .replace("{database}", info.getDatabase() != null ? info.getDatabase() : "")
                .replace("{region}", info.getProperties().getOrDefault("region", "us-east-1"))
                .replace("{s3Output}", info.getProperties().getOrDefault("s3Output", ""));
    }

    @Override
    public String toString() {
        return displayName;
    }
}
