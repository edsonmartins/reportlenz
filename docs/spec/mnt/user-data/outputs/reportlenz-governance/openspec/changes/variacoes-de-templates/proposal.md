# Change: variacoes-de-templates

## Why
A galeria tinha 5 modelos e cada camada de teste usava um payload escrito à mão por modelo — sem volume,
mínimo/nulos, textos longos nem leitura de códigos de barras. Pedido do usuário em 2026-11-27: ampliar os
modelos (fiscais/cobrança — incluindo DANFE e boleto pesquisados na especificação pública —, gerenciais,
etiquetas/crachás, cartas/documentos) e testar todos em todas as camadas, com regressão visual (ADR-022).

## What Changes
- 10 modelos novos no catálogo de referência do `jrxml-core` (15 no total) e na galeria do designer.
- Cenários de teste declarativos por modelo (`reference/cenarios.ts`), emitidos como fixtures.
- Matriz: core (round-trip, gates G1–G6, payload × inputSchema), engine (schema, G7, G8, filtro de classes,
  PDF, códigos de barras decodificados com ZXing), harness (G1), E2E (preview e publish por modelo) e
  regressão visual do PNG do engine.

## Impact
- Affected specs: `catalogo-de-modelos` (nova capability); `e2e` (modificada).
- Affected code: `jrxml-core/src/reference/`, `jrxml-core/scripts/emit-fixtures.mjs`, testes do core,
  `render-service` (teste de matriz + ZXing em test scope), galeria do designer, `e2e/`.
- Depende de: `subreport-por-codename`, `filtro-de-classes-do-engine`, `e2e-interface`.
