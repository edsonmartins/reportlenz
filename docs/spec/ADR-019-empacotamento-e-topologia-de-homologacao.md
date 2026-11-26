# ADR-019 — Empacotamento em contêineres e topologia de homologação

- **Status:** Accepted (2026-11-26, auditoria de homologação)
- **Data:** 2026-11-26
- **Relacionado:** ADR-006 (LGPLv3: JAR da Library não redistribuído a terceiros), ADR-016, ADR-017, ADR-018,
  RFC-003, RFC-004
- **Implementa:** `openspec/changes/empacotamento-deploy`

## Contexto

Bloqueador 4 da auditoria: não há Dockerfile, compose, manifests, README de implantação nem documentação
das variáveis de ambiente, e a UI só alcança o backend pelo proxy de desenvolvimento do Vite.

## Decisão

1. **Duas imagens:**
   - `reportlenz-render`: build Maven multi-stage → `eclipse-temurin:21-jre`, usuário não-root,
     `fontconfig` (export PNG via AWT), healthcheck na porta de management (8088), dados em `/app/data`;
   - `reportlenz-designer`: build do workspace pnpm (core → designer) → `nginx`, servindo a SPA e fazendo
     **proxy reverso** de `/render`, `/assist`, `/publish` e `/templates` para o render-service (origem
     única, sem CORS). O `/config.json` é gerado no start a partir de `OIDC_AUTHORITY`/`OIDC_CLIENT_ID`
     (vazio = modo dev).
2. **Compose de homologação** (`deploy/`): PostgreSQL, Redis **com senha**, S3 (MinIO, imagem
   configurável), Keycloak com o realm `reportlenz` importado, render-service e designer. Só designer
   (8080) e Keycloak (8180) ficam expostos ao host; render-service, actuator, Redis, PostgreSQL e MinIO
   ficam na rede interna.
3. **Issuer público × JWKS interno:** o token traz o issuer **público** (o endereço que o navegador usa no
   Keycloak). Com `REPORTLENZ_OIDC_JWK_SET_URI` definido, o serviço busca as chaves por esse endereço
   interno e **continua validando o issuer público** (`iss`), além de assinatura e expiração. Sem ele,
   vale o discovery do ADR-017.
4. **Realm de homologação versionado** (`deploy/keycloak/realm-reportlenz.json`):
   - client público `reportlenz` (PKCE S256, redirect só para a origem do designer);
   - client confidencial `reportlenz-batch` (service account com o papel `reportlenz-batch`);
   - realm roles dos três papéis;
   - usuários de teste `designer.homolog` e `publicador.homolog`, com senhas **temporárias** definidas
     por variável de ambiente no import.

   Azure AD é configurado como identity provider no realm real, fora deste repositório.
5. **Licença (ADR-006):** a imagem do render-service embute o JAR da Library para uso **server-side
   interno**. Publicar essa imagem em registry público ou entregá-la a terceiros equivale a redistribuir o
   JAR e exige avaliação. O registry deve ser privado.

## Alternativas consideradas

- **Helm/Kubernetes agora:** depende da plataforma do cliente, que não está definida. O compose documenta
  a topologia, e os manifests vêm quando o alvo for conhecido.
- **Designer chamando o render-service direto (CORS):** dois domínios e CORS para manter; a origem única
  é mais simples e mais segura.
- **Hostname único do Keycloak resolvido igual dentro e fora (`/etc/hosts`):** frágil para quem testa; o
  JWKS interno resolve isso sem perder a validação do issuer.

## Consequências

- `docker compose -f deploy/docker-compose.homologacao.yml up` sobe o ambiente completo.
- As senhas do `.env` de homologação são do ambiente de teste. Produção usa um secret manager.
- Riscos residuais documentados no README: Redis precisa ficar privado e com senha (compile cache
  serializado, ADR-016); o render-service deve rodar sem privilégios e com egress restrito.
