# Change: e2e-interface

## Why
O E2E existente (`deploy/e2e-homologacao.sh`) cobre só a API e não roda no CI. Login, editor, preview e
publish pela UI foram validados manualmente no navegador (nota-010). Pedido do usuário em 2026-11-26.

## What Changes
- Pacote `e2e/` (Playwright) no workspace: login REAL por popup no Keycloak, preview Jasper, Publish Wizard
  com papéis e gates (incl. G8), usando usuários/client TEMPORÁRIOS criados pela Admin REST API e removidos
  no teardown.
- Job `e2e` no CI: sobe o compose de homologação com segredos aleatórios, roda o E2E da API e o Playwright,
  publica relatório/traces e logs em falha.

## Impact
- Affected specs: `e2e` (nova capability).
- Affected code: `e2e/`, `pnpm-workspace.yaml`, `.github/workflows/ci.yml`, README.
- Depende de: `empacotamento-deploy`, `autenticacao-keycloak`, `subreport-por-codename`.
