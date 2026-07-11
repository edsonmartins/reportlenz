# Change: migracao-postgresql

## Why
O ADR-009 define PostgreSQL como o banco do repositório de templates; o SQLite foi a decisão de partida
("SQLite pra começar", 2026-07-09) e limita o serviço a UMA instância (pool=1, arquivo local). Com o
registro de templates, auditoria LGPD e batch em produção, chegou a hora de honrar o ADR-009 —
mantendo o SQLite como default de desenvolvimento (zero-config).

## What Changes
- **SQL portável** (subset SQLite ≥3.24 ∩ PostgreSQL): `INSERT OR IGNORE` → `ON CONFLICT DO NOTHING`;
  `rowid` → ordenação por colunas declaradas; schema/DDL já compatível (TEXT/INTEGER, IF NOT EXISTS).
- **Datasource por configuração**: `REPORTLENZ_DB_URL` (+ USER/PASSWORD/POOL) escolhe o banco;
  default continua `jdbc:sqlite:` com pool=1. Driver PostgreSQL entra no classpath; Spring infere o
  driver pela URL.
- **CI valida os DOIS bancos**: suíte do render-service roda no SQLite (como hoje) E contra um service
  container PostgreSQL.
- Validação contra o PostgreSQL REAL da infra do usuário (env `~/.env-projetos/reportlenz/.env`).

## Impact
- Affected specs: `persistencia` (nova capability)
- Affected code: `render-service` (application.yml, pom, RepositorioDeJobs, RepositorioDeTemplates),
  `.github/workflows/ci.yml`.
- ADR: implementa ADR-009 (sem novo ADR — a decisão já estava registrada; esta change define o COMO:
  portabilidade + env-driven).
- Retrocompatível: sem env, tudo segue no SQLite.
