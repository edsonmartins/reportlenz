# ADR-004 — Extração do `jrxml-core` headless

- **Status:** Accepted
- **Data:** 2026-06-28
- **Relacionado:** I-7 (Constituição), ADR-005, RFC-001

## Contexto

O ponto de partida é um fork do `jrxml_web_designer` (Vue 3 + Element Plus, MIT). O stack alvo de
ReportLenz é React 18 + Mantine v9 + Archbase. Evoluir mantendo Vue deixa o produto órfão do ecossistema
do time; reescrever do zero joga fora a parte difícil que o fork resolve: **o parser XML→modelo e o
serializer modelo→JRXML** (ler/escrever JRXML correto, com bandas, estilos, expressões e atributos na
ordem que o engine aceita, é meses de trabalho de casos de borda).

## Decisão

Separar o produto em duas camadas:

### `jrxml-core` — TypeScript headless, framework-agnóstico
Contém o **modelo de domínio** do relatório, o **parser** (JRXML→modelo), o **serializer** (modelo→JRXML
7), o **validador** (contra o esquema JRXML 7 + contra o contrato) e o **extrator de contrato de dados**.
Sem Vue, sem React, sem DOM. É a joia da coroa e o ativo durável (I-1). Testável com Vitest.

### `jrxml-designer-react` — React + Mantine + Archbase
A casca: canvas, paleta, painel de propriedades, expression editor, preview. Construída **sobre** o
`jrxml-core`. Reusa componentes Archbase.

## Estratégia de migração (sem big-bang)

1. Arrancar a lógica de parser/serializer/validação do fork Vue para o pacote `jrxml-core` puro.
2. (Opcional) manter a UI Vue temporariamente rodando sobre o `jrxml-core` extraído.
3. Construir a UI React em paralelo (ADR-005), até aposentar a Vue.

## Consequências

- **Reuso máximo** do trabalho difícil já feito no fork (parser/serializer), sem herdar o acoplamento Vue.
- O core vira **reusável e independente da UI** — pode ser consumido pela UI React, por um CLI, ou por um
  serviço Node/Bun futuro.
- A fronteira `jrxml-core` ↔ UI é a mesma que o próprio Stimulsoft adota (callbacks
  `onOpen/onNew/onSaveReportTemplate` separando "o que o designer edita" de "como o servidor
  resolve/persiste") — validação externa de que o desenho está correto.
- **Custo**: a extração exige entender o código Vue do fork o suficiente para separar domínio de
  apresentação. É a primeira tarefa da Fase 0.

## Caveat

Confirmar o **dialeto JRXML do fork** (provavelmente 6.x). Se for 6.x, o serializer extraído precisa ser
**reescrito/ajustado para o dialeto 7** (ADR-002) — o parser pode aproveitar mais, o serializer menos.
