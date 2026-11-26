# Spec: autenticacao (capability) — Keycloak OIDC, papéis e ator do token

## ADDED Requirements

### Requirement: Toda chamada de API exige JWT válido do realm
O render-service SHALL recusar com 401 qualquer requisição a `/render/**`, `/assist/**`, `/publish/**` e
`/templates/**` sem `Authorization: Bearer` válido emitido pelo issuer configurado.

#### Scenario: Preview sem token
- **WHEN** `POST /render/preview` chega sem cabeçalho Authorization
- **THEN** a resposta é 401 e nada é compilado

#### Scenario: Boot sem issuer com segurança habilitada
- **WHEN** o serviço sobe com segurança habilitada e sem `REPORTLENZ_OIDC_ISSUER`
- **THEN** o boot falha com mensagem que nomeia a variável

### Requirement: Autorização por papel
O serviço SHALL exigir `reportlenz-designer` para preview/IA/verificação/draft/leitura de templates,
`reportlenz-publicador` para publicar/deprecar e `reportlenz-batch` para submeter/consultar lotes, lendo
papéis de `realm_access.roles` e `resource_access.<client>.roles`.

#### Scenario: Designer tenta publicar
- **WHEN** um token só com `reportlenz-designer` chama `POST /templates/x/versoes/1/publicar`
- **THEN** a resposta é 403

#### Scenario: Backend de domínio submete lote
- **WHEN** um token de service account com `reportlenz-batch` (client role) chama `POST /render/batch`
- **THEN** a requisição é aceita (202 com template publicado)

#### Scenario: Designer tenta disparar lote
- **WHEN** um token só com `reportlenz-designer` chama `POST /render/batch`
- **THEN** a resposta é 403

### Requirement: Ator da auditoria vem do token
O repositório de templates SHALL gravar como `actor` o `preferred_username` do token (fallback `sub`),
ignorando qualquer `actor` enviado no corpo.

#### Scenario: Corpo tenta forjar o ator
- **WHEN** um designer `ana` salva um draft com `"actor": "diretor"` no corpo
- **THEN** a versão e a auditoria registram `ana`

#### Scenario: Lote auditado com o service account
- **WHEN** o service account `service-account-erp` submete um lote
- **THEN** a auditoria `rendered_batch` registra `service-account-erp`

### Requirement: Actuator fora da porta da aplicação
O actuator SHALL ser servido somente na porta de management.

#### Scenario: Scrape na porta pública
- **WHEN** `GET /actuator/prometheus` chega na porta da aplicação
- **THEN** a resposta não expõe métricas (401/404)

### Requirement: Modo dev sem autenticação só explícito
Com `reportlenz.seguranca.habilitada=false` o serviço SHALL permitir as chamadas, gravar ator `dev-local` e
registrar WARN no boot.

#### Scenario: Dev local sem Keycloak
- **WHEN** o serviço sobe com segurança desabilitada e recebe um preview sem token
- **THEN** o preview renderiza e o log de boot avisa que a autenticação está desligada

### Requirement: Login na SPA sem browser storage
A UI SHALL autenticar por OIDC Authorization Code + PKCE em popup, manter tokens apenas em memória e enviar
o Bearer em todas as chamadas ao serviço.

#### Scenario: Usuário não autenticado abre o designer
- **WHEN** `/config.json` traz `oidc` e não há sessão SSO
- **THEN** a UI mostra "Entrar" e não chama a API

#### Scenario: Chamadas autenticadas
- **WHEN** o usuário está autenticado e pede um preview
- **THEN** a requisição leva `Authorization: Bearer <access_token>` e nada é gravado em localStorage/sessionStorage

#### Scenario: Modo dev
- **WHEN** `/config.json` traz `oidc: null`
- **THEN** a UI funciona sem login e sem cabeçalho Authorization
