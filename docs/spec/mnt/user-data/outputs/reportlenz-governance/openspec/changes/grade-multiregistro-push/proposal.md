# Change: grade-multiregistro-push

## Why
Uma folha A4 de etiquetas precisa de N linhas no datasource-mestre, mas o payload Push (RFC-002) é um
objeto e o pipeline monta UMA linha — a grade multi-coluna (Fase 3, bloco 7) só imprime uma etiqueta por
render. Pendência registrada no aceite da Fase 3 (nota-007 §4) e confirmada como ponto cego recorrente no
spike de IA da Fase 4.

## What Changes
- Property padrão `reportlenz.datasource.campo` aponta o campo-coleção do contrato que alimenta o
  datasource-mestre (ADR-015).
- `jrxml-core`: serializer emite os `<field>` mestre a partir dos itemFields; `validateContract` valida as
  bandas no escopo dos itemFields; `extractContract` reconstrói a coleção; `avaliarGates` cobre o novo
  arranjo.
- `render-service`: pipeline monta o datasource a partir de `payload[campo]` (achatado + coagido por
  item); demais entradas viram só `$P{}`.
- Designer: "Fonte de linhas" na aba Página; dados de exemplo geram N itens (grade real no preview).
- Referência: `REFERENCIA_ETIQUETA_A4` migra para o novo arranjo (grade de verdade no harness e nos
  testes de qualidade).
- Assistente A: prompt instrui a usar a property em relatórios de unidade repetida.

## Impact
- Affected specs: `push-datasource` (nova capability)
- Affected code: `jrxml-core` (serialize/validate/extract/gates), `render-service` (PipelineDeRender),
  `jrxml-designer-react` (PainelDaPagina, dadosDeExemplo, prompt do assistente no render-service).
- ADR: ADR-015. RFCs relacionadas: RFC-002, RFC-003, RFC-004 §10.
- Depende de: phase-3 (multi-coluna), phase-1 (pipeline). Retrocompatível: sem a property, nada muda.
