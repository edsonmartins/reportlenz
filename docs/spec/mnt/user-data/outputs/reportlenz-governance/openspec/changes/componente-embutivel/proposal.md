# Change: componente-embutivel

## Why
Embutir o editor e o preview nas aplicações web React (Mantine/Archbase) da empresa, publicados no
npmjs.com. Pedido do usuário em 2026-11-27 (ADR-025).

## What Changes
- Estado por instância (fábrica de stores + contexto) com instância padrão para a SPA e os testes.
- Cliente de API configurável (`apiBaseUrl` + `getAccessToken`); o OIDC fica só na SPA.
- `<ReportLenzDesigner>` (modos registro e controlado, eventos) e `<ReportLenzPreview>`.
- Build de biblioteca (`@reportlenz/designer-react`, peers React/Mantine) e `@reportlenz/jrxml-core`
  publicáveis; a SPA de homologação passa a consumir o componente.
- CORS configurável no render-service.
- Aplicação hospedeira de teste (tarballs do `npm pack`, duas instâncias na mesma página) no E2E; workflow
  de release por tag.

## Impact
- Affected specs: `componente` (nova).
- Affected code: `jrxml-designer-react` (stores, cliente de API, entrada da biblioteca, build), `jrxml-core`
  (package.json), `render-service` (CORS), `e2e/` (host de teste), CI.
