# Change: seguranca-expressoes

## Why
Bloqueador 2 da auditoria de homologação (2026-11-26): o render executa Java arbitrário vindo da
requisição (expressões JR sem sandbox, classes instanciadas por nome, subreport/imagem carregados por
localização do payload) e o batch aceitava JRXML bruto, contornando os gates G1–G6, a auditoria e o
anti-Pull (I-2/I-3). Decisão em ADR-016.

## What Changes
- **Gate G7 — Segurança de expressão:** allowlist léxica de todas as expressões + verificações
  estruturais (sem import/scriptlet/factory/customizer), aplicada no compile (antes do cache gravar).
- Preview com violação → 400 `EXPRESSAO_PROIBIDA`; publish → G7 vermelho (bloqueia).
- **Contexto Jasper restrito** no fill/export: subreport por localização recusado, repositório de arquivos
  desligado, URLs só por prefixo permitido (`REPORTLENZ_RECURSOS_URLS_PERMITIDAS`).
- **Batch só com template publicado:** `jrxml` bruto → 400 `JRXML_BRUTO_PROIBIDO`.

## Impact
- Affected specs: `render-seguranca` (nova capability); RFC-003 §4 (contrato do batch) via ADR-016.
- Affected code: `render-service/pipeline` (VerificadorDeExpressoes, CompiladorJrxml, ContextoJasperRestrito,
  PipelineDeRender), `api/BatchController`, `api/TratadorDeErros`, `publish/VerificadorDeGates`;
  testes do batch passam a publicar o template antes.
- Depende de: nada (primeiro dos changes da homologação).
