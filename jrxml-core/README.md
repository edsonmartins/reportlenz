# @reportlenz/jrxml-core

Núcleo headless do ReportLenz (RFC-001): modelo de domínio do relatório, parser (JRXML 7 → modelo),
serializer (modelo → JRXML 7), validação dupla (XSD 7 + contrato) e extrator de contrato de dados.

## Invariantes

- **Headless (I-7):** TypeScript puro — sem Vue, React ou APIs de DOM (o `tsconfig` não inclui a lib `dom`).
- **Dialeto JRXML 7 (ADR-002):** parser/serializer miram a JasperReports Library **7.0.7**; entrada 6.x é
  rejeitada com `LEGACY_DIALECT`.
- **Contract-first (ADR-003):** `<queryString>` é proibido — rejeitado com `CONTRACT_PULL_FORBIDDEN`.

## Scripts

```bash
pnpm test        # Vitest (run único)
pnpm test:watch  # Vitest em watch
pnpm typecheck   # tsc --noEmit
pnpm build       # ESM + d.ts em dist/
```

## Especificações

Fontes de verdade em `../docs/spec/`: `RFC-001-jrxml-core.md`, `ADR-002`, `ADR-003`, `ADR-004` e a
capability spec `spec.md` (cenários de aceite).
