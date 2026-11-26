# ADR-017 — Autenticação Keycloak (OIDC/JWT), papéis e ator derivado do token

- **Status:** Accepted (decisão do usuário em 2026-11-26: "OIDC PKCE na SPA")
- **Data:** 2026-11-26
- **Relacionado:** CONSTITUTION (stack canônico: Auth = Keycloak + Azure AD), I-2 (LGPD), RFC-003,
  RFC-004 (UI sem browser storage), RFC-006 §4 (auditoria), ADR-016
- **Implementa:** `openspec/changes/autenticacao-keycloak`

## Contexto

A auditoria de homologação (2026-11-26) mostrou que nenhum endpoint exige identidade: qualquer cliente que
alcance a porta 8087 publica/depreca templates, dispara lotes e consome a IA (com a chave paga do
provedor). A trilha de auditoria (RFC-006 §4) grava o `actor` **vindo do corpo** — forjável — e a UI nunca
o envia (fica `null`). O actuator (`/actuator/prometheus`) é público na porta da aplicação.

## Decisão

### 1. Resource server JWT (Keycloak como emissor; Azure AD federado NO Keycloak)

- O render-service valida `Authorization: Bearer <JWT>` emitido pelo realm Keycloak configurado em
  `REPORTLENZ_OIDC_ISSUER` (ex.: `https://sso.empresa.com.br/realms/reportlenz`). Azure AD entra como
  *identity provider* do realm — o serviço só conhece o Keycloak.
- Sessão stateless; CSRF desligado (API Bearer, sem cookie de sessão).
- Sem token válido → **401**; token sem o papel exigido → **403**.

### 2. Papéis (realm roles ou client roles do client `reportlenz`)

| Papel | Permite |
|---|---|
| `reportlenz-designer` | `POST /render/preview`, `POST /assist/**`, `POST /publish/verificar`, `POST /templates/{c}/versoes` (draft), `GET /templates/**` |
| `reportlenz-publicador` | `POST /templates/{c}/versoes/{v}/publicar` e `/deprecar` (+ leitura de templates) |
| `reportlenz-batch` | `POST /render/batch`, `GET /render/batch/{id}` — service account do backend de domínio (client credentials) |

Papéis são lidos de `realm_access.roles` e `resource_access.<client>.roles`
(`REPORTLENZ_OIDC_CLIENT_ID`, default `reportlenz`). Separar `publicador` de `designer` mantém o
"quatro olhos" do RFC-006 possível sem forçá-lo.

### 3. Ator da auditoria = identidade do token

`actor` deixa de ser lido do corpo: é `preferred_username` do JWT (fallback `sub`). O campo `actor` no
corpo é **ignorado**. O lote audita o ator do service account (`rendered_batch`).

### 4. Actuator em porta de management separada

`management.server.port` = `REPORTLENZ_MANAGEMENT_PORT` (default **8088**), exposta só na rede interna
(probes e scrape do VictoriaMetrics). Na porta da aplicação, nenhum endpoint do actuator é servido.

### 5. Desligar autenticação só explicitamente (dev local)

`reportlenz.seguranca.habilitada` (env `REPORTLENZ_SEGURANCA_HABILITADA`) default **true**. Com `false`
(dev sem Keycloak), tudo é permitido e o ator é `dev-local`; o serviço registra `WARN` no boot. Sem
`REPORTLENZ_OIDC_ISSUER` e com segurança habilitada, o boot **falha** (fail-closed).

### 6. SPA: OIDC Authorization Code + PKCE por **popup**, token só em memória

- `oidc-client-ts` com `InMemoryWebStorage` para usuário e estado — respeita RFC-004 (sem
  localStorage/sessionStorage). O fluxo por **popup** (e renovação silenciosa por iframe) mantém a janela
  principal viva, então o estado PKCE em memória sobrevive; o redirect de página inteira perderia o estado.
- Ao carregar, tenta `signinSilent` (sessão SSO do Keycloak) — recarregar a página não pede login de novo
  enquanto a sessão do Keycloak existir.
- Configuração em runtime via `/config.json` (`{ "oidc": { "authority", "clientId" } }`), gerado no
  deploy; `oidc: null` = modo dev sem autenticação (casa com §5).
- Todas as chamadas passam por um único `apiFetch` que injeta o Bearer; 401 → volta ao estado "entrar".

## Alternativas consideradas

- **Gateway (oauth2-proxy) na frente:** menos código na SPA, mais infra; o usuário escolheu PKCE na SPA.
- **Redirect de página inteira com estado em sessionStorage:** fluxo mais comum, mas viola a regra da UI.
- **Spring Authorization Server / sessão com cookie:** desnecessário — o Keycloak já é o emissor canônico.
- **Proteger actuator com papel:** obriga o scraper a obter token; porta interna é o padrão operacional.

## Consequências

- Clientes do batch precisam de um client confidencial com o papel `reportlenz-batch`.
- O realm de homologação (clients `reportlenz` público/PKCE e `reportlenz-batch` confidencial, papéis) é
  entregue como export no change `empacotamento-deploy`.
- Testes Spring rodam com `reportlenz.seguranca.habilitada=false`, exceto a suíte de segurança, que usa
  JWTs de teste (spring-security-test) para cobrir 401/403/papéis/ator.
- Rate limit da IA por usuário passa a ser possível (chave = sujeito do token) — change
  `endurecimento-operacional`.
