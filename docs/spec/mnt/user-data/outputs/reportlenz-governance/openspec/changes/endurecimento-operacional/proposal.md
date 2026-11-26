# Change: endurecimento-operacional

## Why
Itens 5–11 da auditoria de homologação (2026-11-26): payloads e PDFs retidos para sempre (LGPD), sem
limites de requisição/lote, IA paga sem rate limit, schema sem migrations, tracing a 100% e CI pulando
8 testes sem aviso. Decisão em ADR-018.

## What Changes
- Retenção: payload zerado ao concluir o job; purga diária de jobs terminados > 30 dias (banco + storage).
- Limites: 413 por tamanho de corpo (inclui chunked); 400 por itens por lote.
- Rate limit da IA por usuário no Redis → 429 com Retry-After.
- Flyway (V1 baseline + V2 índice), `spring.sql.init` desligado.
- Sampling default 0.1.
- CI: fixtures + MinIO no job do render-service e verificação de zero testes pulados.

## Impact
- Affected specs: `operacao` (nova capability).
- Affected code: `render-service` (batch, storage, assist, config, resources/db/migration, pom),
  `.github/workflows/ci.yml`.
- Depende de: `autenticacao-keycloak` (o rate limit usa o ator do token).
