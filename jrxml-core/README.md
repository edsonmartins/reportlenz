# @reportlenz/jrxml-core

Núcleo headless do ReportLenz (RFC-001): modelo de domínio do relatório, parser (JRXML 7 → modelo),
serializer (modelo → JRXML 7), validação dupla (XSD 7 + contrato) e extrator de contrato de dados.

## Instalação

```bash
npm install @reportlenz/jrxml-core
```

```ts
import { parseJrxml, serializeJrxml, extractContract, buildInputSchema, avaliarGates } from '@reportlenz/jrxml-core';

const r = parseJrxml(jrxml);                         // JRXML 7 → modelo (erros tipados, nunca exceção)
if (r.ok) {
  const schema = buildInputSchema(extractContract(r.value));   // contrato de dados → JSON Schema
  const gates = avaliarGates(r.value);                          // G1–G6 de design-time
}
```

Também traz o **catálogo de modelos de referência** (`REFERENCE_TEMPLATES`: boleto, DANFE, fatura,
etiquetas, contrato e outros) com cenários de dados (`CENARIOS`). É usado pelo `@reportlenz/designer-react`.

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

## Licença

MIT.

## Especificações

Fontes de verdade em `../docs/spec/`: `RFC-001-jrxml-core.md`, `ADR-002`, `ADR-003`, `ADR-004` e a
capability spec `spec.md` (cenários de aceite).
