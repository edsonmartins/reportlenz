# Change: filtro-de-classes-do-engine

## Why
A validação contra a JasperReports 7.1.1 (2026-11-26) encontrou o filtro nativo de classes das expressões
(desligado por padrão, existente desde a 7.0.7). Ligado com uma whitelist do ReportLenz, ele vira uma
segunda barreira independente do G7, que age no fill e cobre relatório envenenado no compile cache
(risco residual nº 1 da nota-010). Decisão em ADR-021.

## What Changes
- `net.sf.jasperreports.report.class.filter.enabled=true` + whitelist `reportlenz` alinhada ao G7.
- Teste de paridade: vocabulário legítimo do G7 renderiza com o filtro ligado.
- Testes de bypass: relatório malicioso compilado sem G7 (e vindo "do cache") é bloqueado no fill.

## Impact
- Affected specs: `render-seguranca` (MODIFIED).
- Affected code: `render-service/src/main/resources/jasperreports.properties`, testes.
- Depende de: `seguranca-expressoes`, `subreport-por-codename`.
