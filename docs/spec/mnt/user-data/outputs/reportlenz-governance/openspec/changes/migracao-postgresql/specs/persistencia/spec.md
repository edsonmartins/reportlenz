# Spec: persistencia (capability) — SQLite dev / PostgreSQL produção

## ADDED Requirements

### Requirement: Banco selecionado por configuração
O render-service SHALL selecionar o banco por `REPORTLENZ_DB_URL` (com `REPORTLENZ_DB_USER`/
`REPORTLENZ_DB_PASSWORD`/`REPORTLENZ_DB_POOL`), mantendo SQLite como default sem configuração.

#### Scenario: Default zero-config
- **WHEN** o serviço sobe sem env de banco
- **THEN** usa `jdbc:sqlite:data/reportlenz.db` com pool 1 (comportamento atual)

#### Scenario: Produção PostgreSQL
- **WHEN** `REPORTLENZ_DB_URL=jdbc:postgresql://...` está definido
- **THEN** o serviço usa PostgreSQL com o pool configurado, sem mudança de código

### Requirement: SQL portável entre SQLite e PostgreSQL
Todo SQL do serviço SHALL rodar idêntico nos dois bancos (idempotência de batch, ciclo de vida de
templates e auditoria inclusos).

#### Scenario: Suíte completa nos dois bancos
- **WHEN** a suíte do render-service roda contra SQLite e contra PostgreSQL
- **THEN** todos os testes passam nos dois, sem SQL condicional

#### Scenario: Idempotência preservada no PostgreSQL
- **WHEN** o mesmo lote é reenviado com a mesma idempotencyKey no PostgreSQL
- **THEN** nenhum job/saída duplica (ON CONFLICT DO NOTHING)
