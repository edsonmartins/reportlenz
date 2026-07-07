# ADR-005 — Casca de UI em React/Mantine/Archbase

- **Status:** Accepted
- **Data:** 2026-06-28
- **Relacionado:** ADR-004, RFC-004

## Contexto

O fork de partida usa Vue 3 + Element Plus. O stack canônico do time e do produto é React 18 + Mantine v9
+ a biblioteca interna Archbase. Manter Vue significa um produto fora do ecossistema (sem reuso de
Archbase, sem embarque no Gestor-RQ, atenção do time dividida).

## Decisão

A UI do designer (`jrxml-designer-react`) é construída em **React 18 + Mantine v9 + Archbase**, consumindo
o `jrxml-core` (ADR-004). A UI Vue do fork é **temporária** e aposentada ao fim da Fase 2.

## Diretrizes de UI (extraídas das referências)

Do **Stimulsoft** (benchmark de UX):
- Tooltips de auto-explicação em quase todos os itens de interface (reduz suporte para usuários sem treino).
- **Publish Wizard**: após desenhar, um assistente gera o "pacote de integração" (contrato/`inputSchema`,
  snippet Java de chamada ao render, registro do template no PostgreSQL). Ver RFC-004/RFC-002.
- **Report Checker**: painel de "problemas" (validação XSD + contrato) em vez de erro críptico no save.
- **Galeria de templates iniciais** pt-BR (fatura, etiqueta, comprovante de entrega, formulário).

Do **JasperReports Web Studio** (roadmap = checklist do que dói):
- **Snap-to-geometry** (alinhamento preciso) — prioridade alta.
- **Editor de tabela** com add/delete/reorder de colunas e merge/split de células — prioridade alta
  (fatura é essencialmente tabela).
- Alinhamento por menu contextual.
- Expression Editor, prompts de parâmetros, seleção de imagem/subreport, copy/paste.

Do **Jaspersoft Studio** (padrão de propriedades):
- Painel de propriedades mostra **valor herdado/calculado em cinza-claro** e **valor real em preto** —
  o usuário vê de imediato o que é default e o que sobrescreveu.

## Consequências

- Coerência total com o stack da casa; reuso de Archbase (painéis, inputs, tree).
- Possibilidade de embarcar o designer no Gestor-RQ e outros produtos.
- **Custo**: reconstrução da camada de apresentação. Mitigado por (a) o core já estar pronto na Fase 0 e
  (b) a migração ser incremental (a Vue roda sobre o core enquanto a React é construída).

## Não-objetivo

Não replicar todas as features do Web Studio comercial. ReportLenz é **focado e contract-first**; igualar
a suite inteira não é meta (ver ADR-012 para o plano B caso o esforço de paridade exploda).
