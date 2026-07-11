# Change: cache-compilacao-redis

## Why
Pendência registrada na nota-005 (aceite da Fase 1): o compile cache é in-memory por instância. Com a
migração PostgreSQL habilitando múltiplas instâncias do render-service, cada instância recompila o que
outra já compilou — desperdício exatamente onde o ADR-008 previa compartilhamento (chave =
`sha256(jrxml)` = `jrxml_hash` do ADR-009; conteúdo imutável por construção).

## What Changes
- `CacheDeCompilacaoCompartilhado` (dois níveis, atrás da MESMA interface `CacheDeCompilacao`):
  L1 in-memory LRU por instância + L2 Redis com os bytes do `.jasper` serializado
  (`JRSaver`/`JRLoader`), TTL configurável.
- Redis indisponível degrada para compilar localmente — render NUNCA falha por causa do cache.
- Toggle por env (`REPORTLENZ_COMPILE_CACHE_COMPARTILHADO`, default true — Redis já é dependência da
  fila); `false` volta ao in-memory puro.

## Impact
- Affected specs: `render-cache` (nova capability)
- Affected code: `render-service/pipeline` (novo cache; wiring @Primary condicional), application.yml.
- ADR: implementa o compartilhamento previsto no ADR-008; sem novo ADR.
- Retrocompatível: mesma interface; spans `render.compilacao` continuam contando só compile real.
