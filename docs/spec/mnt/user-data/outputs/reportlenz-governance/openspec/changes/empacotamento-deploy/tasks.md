# Tasks — empacotamento-deploy

- [x] 1.1 ADR-019 + pacote OpenSpec (proposal/spec/tasks)
- [x] 2.1 JWKS interno opcional (REPORTLENZ_OIDC_JWK_SET_URI) com validação do issuer público; testes
- [x] 2.2 Dockerfile do render-service (multi-stage, JRE 21, não-root, fontconfig, healthcheck 8088)
- [x] 2.3 Dockerfile do designer (workspace pnpm → nginx, proxy reverso, /config.json por env, headers)
- [x] 2.4 deploy/: realm Keycloak, compose de homologação, .env.exemplo
- [x] 2.5 README na raiz (dev, homologação, variáveis, operação, riscos residuais)
- [x] 3.1 E2E do ambiente com tokens reais (preview, verificar, publicar, lote, auditoria, actuator)
- [x] 3.2 nota-010 (prontidão para homologação) + estado no guia operacional
