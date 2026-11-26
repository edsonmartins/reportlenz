# Tasks — empacotamento-deploy

- [x] 1.1 ADR-019 + pacote OpenSpec (proposal/spec/tasks)
- [ ] 2.1 JWKS interno opcional (REPORTLENZ_OIDC_JWK_SET_URI) com validação do issuer público; testes
- [ ] 2.2 Dockerfile do render-service (multi-stage, JRE 21, não-root, fontconfig, healthcheck 8088)
- [ ] 2.3 Dockerfile do designer (workspace pnpm → nginx, proxy reverso, /config.json por env, headers)
- [ ] 2.4 deploy/: realm Keycloak, compose de homologação, .env.exemplo
- [ ] 2.5 README na raiz (dev, homologação, variáveis, operação, riscos residuais)
- [ ] 3.1 E2E do ambiente com tokens reais (preview, verificar, publicar, lote, auditoria, actuator)
- [ ] 3.2 nota-010 (prontidão para homologação) + estado no guia operacional
