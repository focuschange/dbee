# Multi-stage build for DBee
FROM eclipse-temurin:23-jdk AS build
WORKDIR /app
COPY gradlew gradlew.bat ./
COPY gradle/ gradle/
COPY build.gradle.kts settings.gradle.kts ./
COPY src/ src/

RUN chmod +x gradlew && ./gradlew bootJar --no-daemon

# Runtime stage
FROM eclipse-temurin:23-jre
WORKDIR /app

COPY --from=build /app/build/libs/*.jar app.jar

# Create data directory
RUN mkdir -p /root/.dbee

EXPOSE 8765

ENTRYPOINT ["java", "-jar", "app.jar"]
