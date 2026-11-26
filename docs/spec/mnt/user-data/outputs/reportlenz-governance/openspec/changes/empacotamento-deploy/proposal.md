# Change: empacotamento-deploy

## Why
Bloqueador 4 da auditoria de homologação (2026-11-26): não há como implantar o produto — sem imagens,
compose, realm de identidade, README ou documentação de variáveis; a UI só funciona pelo proxy do Vite.
Decisão em ADR-019.

## What Changes
- JWKS interno opcional (`REPORTLENZ_OIDC_JWK_SET_URI`) mantendo a validação do issuer público.
- Imagens `reportlenz-render` (JRE 21, não-root) e `reportlenz-designer` (nginx com proxy reverso e
  `/config.json` por env).
- `deploy/`: compose de homologação (PostgreSQL, Redis com senha, MinIO, Keycloak + realm, serviços),
  `.env.exemplo`, realm versionado.
- README na raiz: dev local, homologação, variáveis, operação e riscos residuais.
- E2E do ambiente com tokens reais do Keycloak; nota-010 de prontidão para homologação.

## Impact
- Affected specs: `implantacao` (nova capability).
- Affected code: `render-service` (segurança + Dockerfile), `jrxml-designer-react` (Dockerfile + nginx),
  `deploy/`, `README.md`, `docs/design/nota-010`.
- Depende de: `seguranca-expressoes`, `autenticacao-keycloak`, `endurecimento-operacional`.
