# PostgreSQL de homologação com o banco do Keycloak criado no primeiro boot.
FROM postgres:16-alpine
COPY --chmod=0755 10-keycloak-db.sh /docker-entrypoint-initdb.d/10-keycloak-db.sh
