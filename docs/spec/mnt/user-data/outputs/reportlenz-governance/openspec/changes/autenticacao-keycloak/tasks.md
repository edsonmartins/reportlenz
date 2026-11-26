# Tasks — autenticacao-keycloak

- [x] 1.1 ADR-017 + pacote OpenSpec (proposal/spec/tasks)
- [x] 2.1 Dependências (starter oauth2-resource-server, spring-security-test) + SecurityFilterChain:
      JWT do issuer, papéis de realm/client, regras por endpoint, 401/403, stateless; fail-closed sem issuer
- [x] 2.2 Modo dev (`reportlenz.seguranca.habilitada=false`): permitAll + WARN; testes existentes nesse modo
- [x] 2.3 Ator do token (`IdentidadeAtual`): TemplatesControlador e BatchController ignoram `actor` do corpo
- [x] 2.4 Actuator na porta de management (`REPORTLENZ_MANAGEMENT_PORT`, default 8088)
- [x] 2.5 Testes de segurança: 401 sem token, 403 por papel (designer×publicar, designer×batch),
      client role do service account, ator forjado ignorado, rendered_batch com service account,
      actuator fora da porta pública
- [x] 3.1 SPA: `/config.json` runtime + módulo auth (oidc-client-ts, popup PKCE, InMemoryWebStorage,
      signinSilent no load) + `apiFetch` com Bearer em todas as chamadas
- [x] 3.2 SPA: estado "Entrar"/usuário/sair no App; 401 → volta a "Entrar"; testes (sem login no modo dev,
      Bearer nas chamadas, nada em web storage)
