# Spec: implantacao (capability) — imagens, topologia e ambiente de homologação

## ADDED Requirements

### Requirement: Validação de token com JWKS interno
Com `REPORTLENZ_OIDC_JWK_SET_URI` definido, o serviço SHALL buscar as chaves nesse endereço e validar
assinatura, expiração e o `iss` igual a `REPORTLENZ_OIDC_ISSUER`.

#### Scenario: Token de outro issuer
- **WHEN** chega um token assinado pela chave correta mas com `iss` diferente do issuer configurado
- **THEN** a resposta é 401

#### Scenario: Token válido do realm
- **WHEN** chega um token do realm, assinado e dentro da validade
- **THEN** a requisição é autorizada conforme os papéis

### Requirement: Imagens executáveis e seguras
As imagens SHALL rodar como usuário não-root; a do designer SHALL servir a SPA, fazer proxy da API para o
render-service e gerar `/config.json` a partir do ambiente.

#### Scenario: Designer com OIDC
- **WHEN** o contêiner do designer sobe com `OIDC_AUTHORITY` e `OIDC_CLIENT_ID`
- **THEN** `GET /config.json` devolve esses valores e `/render/preview` é encaminhado ao render-service

#### Scenario: Render-service saudável
- **WHEN** o contêiner do render-service sobe com banco, Redis, S3 e issuer configurados
- **THEN** o healthcheck na porta de management fica verde e a porta da aplicação exige token

### Requirement: Ambiente de homologação reproduzível
`deploy/docker-compose.homologacao.yml` SHALL subir o ambiente completo, com só designer e Keycloak expostos
ao host.

#### Scenario: Fluxo ponta a ponta
- **WHEN** o ambiente sobe e um usuário publicador e o service account do batch obtêm tokens reais
- **THEN** o preview, a verificação, a publicação e um lote completam, a auditoria registra os atores reais
  e o actuator não é alcançável pelo designer
