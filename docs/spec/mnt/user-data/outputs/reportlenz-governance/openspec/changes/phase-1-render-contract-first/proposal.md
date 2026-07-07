# Change: phase-1-render-contract-first

## Why
Com o núcleo pronto (Fase 0), a Fase 1 entrega o que encerra o "não sei como vai ficar" e instaura a
disciplina anti-Pull: o serviço de render em Spring Boot (preview real via Jasper + batch) e o painel de
dados contract-first que gera o `inputSchema`. É a fundação do render de produção (mesmo engine para
preview e lote).

## What Changes
- Serviço de render Spring Boot embarcando JasperReports 7.0.7 (matriz Maven, ADR-007).
- `POST /render/preview` (sync, PDF/PNG) com compile cache por `sha256(jrxml)` (ADR-008).
- `POST /render/batch` (async, idempotente) + `GET /render/batch/{jobId}`.
- Validação de payload contra `inputSchema` antes de preencher (422 se inválido).
- Geração do `inputSchema` (JSON Schema) a partir do `DataContract` (RFC-002).
- Codegen de tipos TS e `record` Java a partir do schema.

## Impact
- Affected specs: `render-service` (nova), `data-contract` (nova)
- Affected code: novo serviço Spring Boot; extensão do `jrxml-core` (`buildInputSchema`, codegen).
- ADRs: ADR-001, ADR-003, ADR-007, ADR-008, ADR-009. RFCs: RFC-002, RFC-003.
- Depende de: phase-0.
