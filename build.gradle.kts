plugins {
    java
    id("org.springframework.boot") version "3.4.4"
    id("io.spring.dependency-management") version "1.1.7"
}

group = "com.dbee"
version = "1.0.0-SNAPSHOT"

java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(23))
    }
}

repositories {
    mavenCentral()
}

dependencies {
    // Spring Boot
    implementation("org.springframework.boot:spring-boot-starter-web")

    // SSH tunneling
    implementation("com.github.mwiede:jsch:0.2.21")

    // Connection pooling
    implementation("com.zaxxer:HikariCP:5.1.0")

    // Excel export
    implementation("org.apache.poi:poi-ooxml:5.2.5")

    // JDBC drivers
    implementation("com.mysql:mysql-connector-j:8.3.0")
    implementation("org.postgresql:postgresql:42.7.3")
    implementation("com.oracle.database.jdbc:ojdbc11:23.3.0.23.09")
    implementation("org.xerial:sqlite-jdbc:3.45.3.0")
    implementation("com.microsoft.sqlserver:mssql-jdbc:12.6.1.jre11")

    // Testing
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("com.h2database:h2:2.2.224")
}

tasks.test {
    useJUnitPlatform()
}
