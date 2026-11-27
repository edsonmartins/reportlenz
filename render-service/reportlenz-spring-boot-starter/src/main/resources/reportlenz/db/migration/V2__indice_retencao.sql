-- V2 (ADR-018): a purga de retenção filtra por status + atualizado_em.
CREATE INDEX IF NOT EXISTS idx_render_job_retencao ON render_job (status, atualizado_em);
