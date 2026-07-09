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
-- idempotente: INSERT OR IGNORE não duplica saída de item já processado.
CREATE TABLE IF NOT EXISTS render_job_saida (
    job_id     TEXT NOT NULL,
    idx        INTEGER NOT NULL,
    referencia TEXT,                            -- link/caminho no storage (sucesso)
    erro       TEXT,                            -- mensagem (falha do item)
    PRIMARY KEY (job_id, idx)
);
