# Imagem do render-service (ADR-019 §1). Build: docker build -t reportlenz-render render-service
# Licença (ADR-006): a imagem embute o JAR da JasperReports Library (LGPLv3) para
# uso SERVER-SIDE interno — publique só em registry PRIVADO.

FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /src
# Multi-módulo (ADR-026): parent + módulos; a imagem empacota o reportlenz-app.
COPY pom.xml .
COPY reportlenz-core/pom.xml reportlenz-core/
COPY reportlenz-spring-boot-starter/pom.xml reportlenz-spring-boot-starter/
COPY reportlenz-app/pom.xml reportlenz-app/
RUN mvn -q -B -pl reportlenz-app -am dependency:go-offline || true
COPY reportlenz-core/src reportlenz-core/src
COPY reportlenz-spring-boot-starter/src reportlenz-spring-boot-starter/src
COPY reportlenz-app/src reportlenz-app/src
# Testes rodam no CI (com Redis/PostgreSQL/MinIO); aqui só empacota.
RUN mvn -q -B -DskipTests -pl reportlenz-app -am package \
    && cp reportlenz-app/target/reportlenz-render-service-*.jar /src/app.jar

FROM eclipse-temurin:21-jre
# fontconfig: export PNG do preview usa AWT; curl: healthcheck.
RUN apt-get update \
    && apt-get install -y --no-install-recommends fontconfig curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 10001 reportlenz \
    && useradd --system --uid 10001 --gid reportlenz --home-dir /app --shell /usr/sbin/nologin reportlenz \
    && mkdir -p /app/data && chown -R reportlenz:reportlenz /app
WORKDIR /app
COPY --from=build --chown=reportlenz:reportlenz /src/app.jar /app/app.jar
USER 10001
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75 -Djava.awt.headless=true" \
    REPORTLENZ_DB_PATH=/app/data/reportlenz.db \
    REPORTLENZ_STORAGE_LOCAL_PATH=/app/data/saidas
# 8087 = API (exige token) · 8088 = management (rede interna: probes + scrape)
EXPOSE 8087 8088
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5 \
    CMD curl -fs http://localhost:8088/actuator/health || exit 1
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
