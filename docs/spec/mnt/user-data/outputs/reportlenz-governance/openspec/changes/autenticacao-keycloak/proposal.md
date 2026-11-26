# Change: autenticacao-keycloak

## Why
Bloqueadores 1 e 3 da auditoria de homologação (2026-11-26): nenhum endpoint exige identidade (a
Constituição define Keycloak + Azure AD) e a auditoria LGPD grava um `actor` forjável vindo do corpo, que a
UI nem envia. Item 11: actuator público na porta da aplicação. Decisão em ADR-017.

## What Changes
- render-service como **resource server JWT** (issuer Keycloak via `REPORTLENZ_OIDC_ISSUER`); 401/403.
- **Papéis** `reportlenz-designer`, `reportlenz-publicador`, `reportlenz-batch` por endpoint.
- **Ator da auditoria = `preferred_username` do token**; `actor` do corpo ignorado.
- **Actuator na porta de management** (`REPORTLENZ_MANAGEMENT_PORT`, default 8088).
- Segurança desligável só explicitamente (`REPORTLENZ_SEGURANCA_HABILITADA=false`, dev); fail-closed sem
  issuer.
- **SPA**: login OIDC + PKCE por popup (`oidc-client-ts`, token em memória), `signinSilent` no load,
  `/config.json` em runtime, `apiFetch` único com Bearer.

## Impact
- Affected specs: `autenticacao` (nova capability).
- Affected code: `render-service` (pom, config/Seguranca*, controllers de templates/batch, application.yml,
  testes), `jrxml-designer-react` (auth/, chamadas fetch, App).
- Depende de: `seguranca-expressoes` (sem ele, um usuário autenticado ainda executaria código no servidor).
