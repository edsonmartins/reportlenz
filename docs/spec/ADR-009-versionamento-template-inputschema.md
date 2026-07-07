# ADR-009 — Versionamento de template + inputSchema

- **Status:** Accepted
- **Data:** 2026-06-28
- **Relacionado:** I-1, I-5 (Constituição), ADR-003, RFC-002, RFC-006

## Contexto

O template é o ativo durável (I-1) e a unidade de governança (I-5). Um template não é só o JRXML — é o
JRXML **acoplado ao seu contrato de dados** (`inputSchema`). Mudanças no contrato (campo novo, tipo
alterado) impactam quem produz o payload (o backend). É preciso versionar os dois juntos e validar o
payload contra o contrato.

## Decisão

Persistir cada template no **PostgreSQL** como um artefato versionado que guarda **JRXML + inputSchema +
metadados**, com versionamento explícito.

### Modelo (esboço)

```
report_template
  id              uuid pk
  codename        text            -- ex.: "comprovante-entrega-rq"
  created_at      timestamptz

report_template_version
  id              uuid pk
  template_id     uuid fk -> report_template
  version         int             -- monotônico por template
  jrxml           text            -- fonte JRXML 7
  input_schema    jsonb           -- JSON Schema do contrato (RFC-002)
  jrxml_hash      text            -- sha256, chave do compile cache (ADR-008)
  status          text            -- draft | published | deprecated
  created_at      timestamptz
  created_by      text
```

### Regras
1. **JRXML e inputSchema versionam juntos.** Mudou o contrato → nova versão.
2. **Validação dupla no save** (gate de governança):
   - contra o esquema **JRXML 7** (XML bem-formado e válido) — recusa `<queryString>` (ADR-003);
   - contra o **contrato** (toda expressão `$F{}/$P{}/$V{}` referencia campo/param/var declarado).
3. **Validação de payload em run-time:** o backend valida o payload contra o `input_schema` da versão
   **antes** de preencher o relatório. Payload que não satisfaz o contrato → erro 422, sem render.
4. Cada decisão grande do designer (proibição de Pull, contrato-primeiro, preview round-trip) é também um
   ADR (este pacote).

## Consequências

- **LGPD/auditoria**: dá para rastrear qual versão de contrato gerou qual saída.
- **Compatibilidade controlada**: o `jrxml_hash` casa com o compile cache (ADR-008) e detecta drift de
  template entre versão da Library e dialeto emitido (ADR-002).
- O `inputSchema` em `jsonb` permite query/validação no Postgres e geração de tipos (RFC-002).
- **Custo**: disciplina de versionamento e gates de validação no save. É parte do princípio spec-driven
  (I-5), não overhead opcional.
