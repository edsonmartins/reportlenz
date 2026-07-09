# Nota de design 003 — Aceite da Fase 0 (`phase-0-extract-jrxml-core`)

- **Data:** 2026-07-08
- **Tarefas:** phase-0/9.1, phase-0/9.2
- **Relacionado:** RFC-001 §8, CLAUDE.md §7 (gates), ADR-013

## Veredito

**Fase 0 concluída.** Todos os critérios de aceite da RFC-001 §8 verificados com evidência
executável (auditoria limpa de 2026-07-08: lint + typecheck + 65 testes Vitest + build + harness
Java, a partir de `dist/` recém-gerado).

## Critérios da RFC-001 §8 × evidência

| Critério | Evidência |
|---|---|
| Parse + serialize round-trip validando para os JRXMLs de referência | `test/roundtrip.test.ts`: equivalência semântica (`parse ∘ serialize ≡ id`) e **idempotência byte a byte** para o quarteto fatura/comprovante/formulário/etiqueta A4. Validação "contra XSD 7" foi redefinida pelo **ADR-013** (não existe XSD oficial): o gate de verdade é o **harness Java** — **4/4 aceitos** pelo load + compile da JasperReports Library **7.0.7 real** (job `jr7-harness` no CI). |
| `validateContract` recusa `<queryString>` e expressões órfãs | Pull recusado em qualquer forma no parse/`validateSchema` (`CONTRACT_PULL_FORBIDDEN` para `<query>`, `<queryString>`, `<connectionExpression>` — `test/parse-forbidden.test.ts`); órfãs via `validateContract` (`EXPR_UNKNOWN_REF` com nome/localização, ciente de escopo master × célula de tabela — `test/validate.test.ts`). No nível do modelo, Pull é impossível **por construção** (não há campo para query). |
| `extractContract` produz `DataContract` consumível pela RFC-002 | `test/extract.test.ts`: cópia profunda desacoplada, variáveis marcadas como calculadas (fora do payload), `itemFields` de coleções preservados; ciclo `extract(parse(serialize(t)))` fechado. |
| Zero dependência de framework de UI no bundle | Auditoria de `dist/`: **único import externo é `fast-xml-parser`** (permitido pela RFC-001 §2); `pnpm list --prod` = 1 dependência. Guardas permanentes: tsconfig sem lib `dom`, ESLint `no-restricted-imports` (Vue/React) e grep de bundle no CI. |

## Gates (CLAUDE.md §7) na Fase 0

- **G1 (dialeto 7 aceito pela Library, ADR-013):** ✅ harness 4/4 no CI.
- **G2 (anti-Pull):** ✅ por construção no modelo + recusa tripla no parse + teste de output.
- **G3 (integridade de expressão):** ✅ `validateContract` com escopos e built-ins.
- **G4 (sem construções 6.x):** ✅ `LEGACY_DIALECT` (scanDialect) + ausência de marcadores no output.
- **G5 (inputSchema) / G6 (jrxml_hash):** N/A na Fase 0 — nascem na Fase 1 (RFC-002/ADR-009).

## Números finais

- 20 commits `phase-0/*`; 65 testes Vitest; 4 templates de referência; 1 dependência de runtime.
- Descobertas registradas: nota 001 (fork é 6.x), ADR-013 + nota 002 (não há XSD 7; dialeto real:
  `<element kind>`, `<query language>`, seções de banda única sem `<band>` aninhado).

## Pendências herdadas pela Fase 1

- Matriz Maven exata da 7.0.7 (CLAUDE.md §8.2) — validar contra o BOM ao montar o `pom.xml` do
  serviço de render (o harness já provou `jasperreports`, `jasperreports-jdt`, `jasperreports-barcode4j`).
- `FieldDecl.required` não tem representação em JRXML — persiste no `inputSchema` (ADR-009).
- Subconjunto: crosstab, charts, `returnValue` de subreport, colunas de grupo de tabela (Fase 3),
  box/paddings em estilos — expansão incremental conforme demanda das fases seguintes.
