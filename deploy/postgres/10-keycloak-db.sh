#!/bin/sh
# Banco separado para o Keycloak no mesmo PostgreSQL de homologação.
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
CREATE DATABASE keycloak;
SQL
