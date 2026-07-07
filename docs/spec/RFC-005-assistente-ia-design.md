# RFC-005 — Assistente de IA de design (NL→JRXML, NL→expressão)

- **Status:** Draft
- **Fase:** 4
- **Relacionado:** ADR-010, ADR-003, ADR-009, RFC-001, RFC-002, RFC-004
- **Implementa:** `openspec/changes/phase-4-ai-governance`

## 1. Objetivo

Especificar os assistentes de IA do designer, rodando em **inferência local** (I-4, ADR-010): geração de
JRXML inicial a partir de linguagem natural + contrato, e geração de expressão JR a partir de linguagem
natural. A IA acelera, mas **não fura gates** (validação obrigatória pós-geração).

## 2. Assistente A — NL → JRXML inicial

### Entrada
- Descrição NL do relatório (ex.: *"comprovante de entrega com cabeçalho da Rio Quality, dados do cliente,
  lista de itens, área de assinatura e QR do pedido"*).
- O **contrato de dados** já declarado (RFC-002) — vocabulário de fields/params/vars.

### Saída
- Um `ReportTemplate` (modelo do RFC-001) → JRXML 7, com bandas e elementos bindados ao contrato.

### Pipeline
```
NL + DataContract --> modelo local --> ReportTemplate (draft)
                                   --> serializeJrxml() (RFC-001)
                                   --> validateSchema + validateContract (gate)
                                   --> draft editável no canvas (RFC-004)
```

## 3. Assistente B — NL → expressão JR

### Entrada
- NL (ex.: *"total do item = quantidade vezes preço unitário"*) + contrato.

### Saída
- Expressão JR válida (ex.: `$F{quantidade}.multiply($F{precoUnitario})`), validada contra o contrato
  (RFC-004 §5).

## 4. Restrições invioláveis

1. **Inferência local por padrão** (I-4, ADR-010): NL, contrato e dados de exemplo não saem para nuvem de
   terceiros sem decisão explícita + consentimento.
2. **Respeita contract-first** (ADR-003): a IA **nunca** gera `<queryString>`. Prompt/sistema proíbe Pull.
3. **Validação obrigatória pós-geração** (ADR-009): JRXML/expr da IA passam pelo mesmo XSD + contrato. IA
   não tem caminho privilegiado.
4. Saída da IA é sempre **draft editável** — nunca auto-publicada.

## 5. Infra

- Modelos servidos localmente (GPU RTX 3060 12GB / Mac Mini M4). Avaliar modelos com bom desempenho em
  geração de XML estruturado.
- Spike obrigatório antes de promover ADR-010 a Accepted: medir taxa de JRXML 7 válido na primeira geração
  e qualidade do binding ao contrato.

## 6. Riscos

- Qualidade incerta de JRXML 7 gerado por modelo local (esquema extenso). Mitigação: validação obrigatória
  + draft editável + biblioteca de blocos como fallback (composição em vez de geração livre).
- Alucinação de nomes de campo fora do contrato → capturada por `validateContract` (`EXPR_UNKNOWN_REF`).

## 7. Critérios de aceite

- Assistente A produz draft que **valida** (XSD + contrato) em ≥ X% dos casos de teste (X definido no spike).
- Assistente B produz expressão válida referenciando apenas o contrato.
- Nenhuma chamada sai para nuvem por padrão.
- Nenhuma saída contém `<queryString>`.
