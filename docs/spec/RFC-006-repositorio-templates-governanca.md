# RFC-006 — Repositório de templates e gates de governança

- **Status:** Draft
- **Fase:** 4 (mas gates de validação já na Fase 1)
- **Relacionado:** ADR-009, ADR-003, RFC-002, I-5 (Constituição)
- **Implementa:** `openspec/changes/phase-4-ai-governance`

## 1. Objetivo

Especificar o repositório de templates (versionamento, ciclo de vida, gates de governança) que materializa
o princípio spec-driven (I-5) e o versionamento conjunto JRXML+contrato (ADR-009).

## 2. Ciclo de vida do template

```
draft ──publish──> published ──supersede──> deprecated
  ^                    |
  └──── nova versão ───┘  (mudança no JRXML ou no contrato => nova versão)
```

- **draft**: editável, não usável em produção.
- **published**: imutável; usável pelo `POST /render/batch`. Nova edição cria nova versão draft.
- **deprecated**: mantida para auditoria/reprocessamento histórico; não recebe novos jobs.

## 3. Gates de governança (validação obrigatória)

Aplicados no **publish** (e continuamente no editor via ReportChecker):

| Gate | Regra | Erro |
|------|-------|------|
| G1 — XSD 7 | JRXML válido contra `jasperreports.xsd` 7.0.7 | `SCHEMA_INVALID` |
| G2 — Anti-Pull | sem `<queryString>` (ADR-003) | `CONTRACT_PULL_FORBIDDEN` |
| G3 — Integridade de expressão | toda `$F/$P/$V` referencia o contrato | `EXPR_UNKNOWN_REF` |
| G4 — Dialeto | sem construções 6.x (ADR-002) | `LEGACY_DIALECT` |
| G5 — Contrato presente | `inputSchema` gerado e válido | `CONTRACT_MISSING` |
| G6 — Hash | `jrxml_hash` recalculado e consistente | `HASH_MISMATCH` |

Publish só prossegue com **todos os gates verdes**. "Pass 5 como autoridade sobre done" (I-5): done = gates
verdes + critérios de aceite da spec da fase.

## 4. Modelo de dados

Conforme ADR-009 (`report_template`, `report_template_version`), com adição de auditoria:

```
report_template_audit
  id          uuid pk
  version_id  uuid fk
  action      text     -- created | published | deprecated | rendered_batch
  actor       text
  at          timestamptz
  meta        jsonb    -- ex.: jobId, contagem, idempotencyKey
```

## 5. Biblioteca de blocos reutilizáveis (Fase 4)

Blocos versionados, independentes de template, referenciáveis: cabeçalho timbrado, rodapé com totais,
bloco de assinatura (comprovante), bloco de QR de pedido. Cada bloco tem seu próprio mini-contrato; ao
inserir num template, o contrato do bloco é mesclado ao contrato do template (com checagem de conflito de
nomes).

## 6. Integração com governança do ecossistema

- Cada template publicado pode ser exportável para um backlog Jira-importável (padrão usado em outros
  produtos do portfólio).
- Decisões estruturais já estão nos ADRs deste pacote; novas capacidades entram como OpenSpec change
  packages.

## 7. Critérios de aceite

- Publish bloqueado se qualquer gate G1–G6 falhar.
- Versões imutáveis após published; nova edição => nova versão.
- Auditoria registra publish e batch (rastreabilidade LGPD).
- Biblioteca de blocos com mescla de contrato e detecção de conflito.
