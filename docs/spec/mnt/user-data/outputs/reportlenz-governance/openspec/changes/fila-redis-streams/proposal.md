# Change: fila-redis-streams

## Why
Último item de infra da nota-005: a fila LPUSH/BRPOP entrega no máximo uma vez — worker que morre entre
o pop e o processamento PERDE o job (fica `queued`/`running` para sempre no banco). Com múltiplas
instâncias (PostgreSQL + compile cache compartilhado), a fila precisa de at-least-once real.

## What Changes
- Fila sobre **Redis Streams + consumer group**: XADD para enfileirar; XREADGROUP para consumir
  (consumidor com nome único por instância); **XACK explícito só DEPOIS de processar**.
- **Reivindicação de órfãos**: mensagens pendentes de consumidores mortos (idle > configurável,
  default 60s) são reclamadas via XPENDING/XCLAIM por qualquer instância viva.
- **Poison cap**: mensagem reentregue mais de N vezes (default 5) é confirmada e o job marcado
  `failed` — sem loop infinito.
- At-least-once + processamento idempotente (PK job_id+idx, ON CONFLICT DO NOTHING) = resultado
  efetivamente exactly-once nas saídas.

## Impact
- Affected specs: `fila` (nova capability)
- Affected code: `render-service/batch` (FilaDeRender → streams; ProcessadorDeLote confirma pós-processo).
- Fecha o TRIO de infra da nota-005 (compile cache Redis ✓, presigned ✓, streams ✓).
- Migração: a lista antiga (`LPUSH`) é abandonada — jobs eventualmente presos podem ser reenfileirados
  reenviando o batch com a MESMA idempotencyKey (comportamento já garantido).
