# ADR-015 — Grade multi-registro em modo Push (`reportlenz.datasource.campo`)

- **Status:** Proposed
- **Data:** 2026-07-10
- **Relacionado:** ADR-003 (contract-first), ADR-009, ADR-011 (térmica fora de escopo), RFC-002, RFC-003,
  nota-007 §4 (pendência registrada no aceite da Fase 3)
- **Implementa:** `openspec/changes/grade-multiregistro-push`

## Contexto

O payload Push é UM objeto (RFC-002) e o pipeline monta o datasource-mestre com UMA linha — o detail
imprime uma vez. Uma folha A4 de etiquetas (3×8) precisa de N linhas no mestre. Hoje a grade só é
demonstrável chamando o engine direto (como faz o `ReferenciasDeQualidadeTest`); o preview do designer e
o batch imprimem UMA etiqueta por payload. O spike da Fase 4 mostrou que até os modelos de IA "esperam"
a semântica de coleção para etiquetas — o gap é real e recorrente.

## Decisão (proposta)

Um template PODE declarar qual campo-coleção do contrato alimenta o datasource-mestre, via property
padrão do JRXML (serializa, versiona e audita naturalmente):

```xml
<property name="reportlenz.datasource.campo" value="etiquetas"/>
```

### Semântica

1. **Contrato**: `etiquetas` é um field `collection` com `itemFields` (ex.: `produto_nome`, `preco`,
   `ean`). Com a property ativa, o contrato só admite ESSA coleção como field; todo valor de topo
   restante deve ser `parameter` (título, filial etc.). O `inputSchema` continua aninhado:
   `{ etiquetas: [ {...} ], ...params }`.
2. **JRXML**: os `<field>` do relatório-mestre são os **itemFields** da coleção (linha = item). O field
   da coleção em si NÃO vira `<field>` mestre.
3. **Pipeline (render-service)**: com a property presente, o datasource-mestre é
   `payload[campo]` (List de mapas; cada item achatado + coagido como hoje). Demais entradas do payload
   alimentam apenas `$P{}`. Payload sem a coleção (ou vazia) → `noData` do engine.
4. **Designer**: a aba "Página" ganha "Fonte de linhas": registro único (default, comportamento atual) ou
   um campo-coleção do contrato. O preview gera N itens de amostra — a grade aparece de verdade.
5. **Validação (G3)**: com a property ativa, expressões `$F{}` das bandas validam contra os
   **itemFields** da coleção (+ builtins/params/vars). `extractContract` faz o inverso (reconstrói a
   coleção a partir da property + fields mestre).

### Restrições (V1)

- Exatamente UMA coleção-datasource por template; `table`/`subreport` dentro de template com a property
  ativa ficam FORA do V1 (etiqueta/crachá não precisam; remove ambiguidade de escopo aninhado).
- Sem a property, NADA muda (retrocompatível por construção).
- Continua Push puro (I-3): a property aponta para um campo do CONTRATO — não existe query/conexão.

## Alternativas consideradas

- **Payload como array de topo**: quebraria RFC-002 (payload = objeto) e o `inputSchema` de todos os
  templates existentes.
- **Batch com N payloads → 1 PDF**: muda a semântica de idempotência/saída por item do RFC-003.
- **Expressão de datasource no elemento raiz**: não existe no dialeto 7 para o mestre; property é o
  mecanismo canônico de metadado.

## Consequências

- Etiquetas A4 em grade passam a funcionar de ponta a ponta (designer → preview → batch) — fecha a
  pendência da nota-007 §4 e o cenário "Grade de etiquetas" da RFC-004 §10 em produção.
- Custo: suporte simétrico em core (serializer/validator/extractor), pipeline e UI; +1 conceito no
  modelo mental do usuário (mitigado pela UI: um select com auto-explicação).
- A IA (Assistente A) ganha instrução para usar a property em relatórios de unidade repetida — deve
  subir a taxa de draft válido nos casos de etiqueta.
