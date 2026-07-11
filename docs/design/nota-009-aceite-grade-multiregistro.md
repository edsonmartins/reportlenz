# Nota 009 — Aceite do change `grade-multiregistro-push` (ADR-015)

**Data:** 2026-07-10 · **Change:** `grade-multiregistro-push` (5 blocos, 10/10 tarefas)

## 1. O que fecha

A pendência da **nota-007 §4** (grade multi-registro em modo Push) está encerrada em TODO o caminho de
produção: a property `reportlenz.datasource.campo` aponta o campo-coleção do contrato que alimenta o
datasource-mestre — um item = uma linha/etiqueta.

## 2. Cenários da spec `push-datasource` — evidências

| Cenário | Evidência |
| --- | --- |
| Grade de ponta a ponta (9 itens → 3×3 numa folha) | `GradeDeEtiquetasTest` + `ReferenciasDeQualidadeTest.etiquetaA4_gradeDe9ItensViaPipelinePushNumaFolha` (pelo PRÓPRIO pipeline Push, fixture real) |
| Payload sem a coleção → noData sem erro | idem + serializer agora emite `whenNoDataType="NoDataSection"` (gap encontrado no bloco 2 — a banda noData nunca imprimia) |
| Escopo de validação por itemFields; field escalar de topo rejeitado | `datasource.test.ts` (G3 por item; "mova para parameter"; restrição V1 sem table/subreport) |
| Round-trip preserva o arranjo | `datasource.test.ts` — byte-idempotente; limitação documentada: `description` da coleção sintetizada não sobrevive |
| Fonte de linhas na UI + preview em grade | `fonteDeLinhas.test.tsx` (select na aba Página; `gerarDadosDeExemplo` com 9 itens) |

`REFERENCIA_ETIQUETA_A4` migrada para o arranjo (harness 4/4 pela Library 7.0.7 real). Retrocompatível:
sem a property, nada muda (teste dedicado).

## 3. IA (bloco 4)

Prompt do Assistente A atualizado: relatório de unidade repetida usa a grade (property + coleção +
multi-coluna + noData). Re-medição do spike: o caso "etiqueta de preço em grade de 3 colunas" — que
falhava sistematicamente antes do ADR-015 — agora gera draft VÁLIDO usando a property corretamente
(verificado nas rodadas e por inspeção do draft). Taxa geral observada nas rodadas pós-mudança: 60–80%
(mesma faixa da nota-008; a variância entre rodadas é do modelo, não do arranjo).

## 4. Veredito

Change **aceito**: tarefas 10/10, gates verdes, CI 4/4. O ReportLenz imprime folhas de etiquetas A4 de
verdade — designer → preview → publish → batch.
