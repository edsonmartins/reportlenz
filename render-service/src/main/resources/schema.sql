-- Estado durável do batch (RFC-003 §4, tarefas phase-1/5.x) — SQLite.
-- A idempotência do lote é a UNIQUE em idempotency_key: reenvio com a mesma
-- chave reaproveita o job existente, sem documentos duplicados.

CREATE TABLE IF NOT EXISTS render_job (
    id              TEXT PRIMARY KEY,
    idempotency_key TEXT NOT NULL UNIQUE,
    status          TEXT NOT NULL,              -- queued | running | done | failed
    total           INTEGER NOT NULL,
    concluidos      INTEGER NOT NULL DEFAULT 0,
    falhas          INTEGER NOT NULL DEFAULT 0,
    jrxml           TEXT NOT NULL,
    input_schema    TEXT,                       -- JSON (inputSchema da versão), opcional
    payloads        TEXT NOT NULL,              -- JSON array com os N payloads
    criado_em       TEXT NOT NULL,
    atualizado_em   TEXT NOT NULL
);

-- Uma linha por item do lote; a PK (job_id, idx) torna o reprocessamento
-- idempotente: INSERT ... ON CONFLICT DO NOTHING não duplica saída de item já
CREATE TABLE IF NOT EXISTS render_job_saida (
    job_id     TEXT NOT NULL,
    idx        INTEGER NOT NULL,
    referencia TEXT,                            -- link/caminho no storage (sucesso)
    erro       TEXT,                            -- mensagem (falha do item)
    PRIMARY KEY (job_id, idx)
);

-- ---------------------------------------------------------------------------
-- Repositório de templates (ADR-009 / RFC-006 §2 e §4, tarefas phase-4/5.x).
-- SQLite (decisão 2026-07-09/2026-07-10; migrar p/ PostgreSQL quando escalar).
-- published é IMUTÁVEL: nova edição = nova versão draft.

CREATE TABLE IF NOT EXISTS report_template (
    id        TEXT PRIMARY KEY,
    codename  TEXT NOT NULL UNIQUE,
    criado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS report_template_version (
    id           TEXT PRIMARY KEY,
    template_id  TEXT NOT NULL REFERENCES report_template(id),
    version      INTEGER NOT NULL,
    jrxml        TEXT NOT NULL,
    input_schema TEXT NOT NULL,               -- JSON Schema do contrato (RFC-002)
    jrxml_hash   TEXT NOT NULL,               -- sha256; chave do compile cache (ADR-008/G6)
    status       TEXT NOT NULL,               -- draft | published | deprecated
    criado_em    TEXT NOT NULL,
    criado_por   TEXT,
    UNIQUE (template_id, version)
);

-- Auditoria (RFC-006 §4): rastreabilidade LGPD de publish e batch.
CREATE TABLE IF NOT EXISTS report_template_audit (
    id         TEXT PRIMARY KEY,
    version_id TEXT NOT NULL REFERENCES report_template_version(id),
    action     TEXT NOT NULL,                 -- created | published | deprecated | rendered_batch
    actor      TEXT,
    at         TEXT NOT NULL,
    meta       TEXT                           -- JSON (ex.: jobId, contagem, idempotencyKey)
);
