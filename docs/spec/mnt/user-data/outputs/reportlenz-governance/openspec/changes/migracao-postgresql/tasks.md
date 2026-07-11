# Tasks — migracao-postgresql

## 1. SQL portável
- [x] 1.1 `INSERT OR IGNORE` → `ON CONFLICT (job_id, idx) DO NOTHING`; `rowid` → ordenação declarada
- [x] 1.2 Revisar schema.sql/queries (tipos, upserts) contra o subset comum

## 2. Configuração
- [x] 2.1 `REPORTLENZ_DB_URL/USER/PASSWORD/POOL` no application.yml (driver inferido pela URL);
      driver PostgreSQL no pom; default SQLite intacto

## 3. Validação
- [x] 3.1 Suíte completa contra o PostgreSQL real da infra (192.168.1.110:5444) — 51/51 na primeira rodada
- [x] 3.2 CI: service container PostgreSQL + segunda rodada da suíte do render-service
