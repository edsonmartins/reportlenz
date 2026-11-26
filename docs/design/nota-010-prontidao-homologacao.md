# Nota 010 — Prontidão para homologação (auditoria de 2026-11-26 e correções)

- **Data:** 2026-11-26
- **Branch:** `homologacao-correcoes`
- **Changes:** `seguranca-expressoes` (ADR-016), `autenticacao-keycloak` (ADR-017),
  `endurecimento-operacional` (ADR-018), `empacotamento-deploy` (ADR-019)

## 1. Parecer

A auditoria de 2026-11-26 encontrou o projeto funcionalmente maduro, com todas as suítes verdes, mas
**não pronto para homologação**. Havia 4 bloqueadores e 8 itens importantes. Todos os bloqueadores e
todos os itens importantes foram especificados (ADR + OpenSpec) e implementados, e os critérios foram
validados com testes automatizados e com um ambiente de homologação real (contêineres + Keycloak).

**Parecer atual: pronto para homologação**, com os riscos residuais da §4 aceitos como requisitos de
implantação.

## 2. Itens da auditoria → resolução

| # | Item | Resolução | Evidência |
|---|---|---|---|
| B1 | Sem autenticação/autorização | Resource server JWT (Keycloak), 3 papéis, fail-closed | `SegurancaTest` (12), `JwksInternoTest` (5), E2E |
| B2 | Execução de Java arbitrário (expressões, scriptlets, subreport/imagem por localização); batch com JRXML bruto | Gate G7 (allowlist léxica + estrutura), contexto Jasper com política de recursos, batch só de template publicado | `SegurancaDeExpressoesTest` (40), `RecursosRestritosTest` (4, com controle), E2E |
| B3 | Ator da auditoria forjável / sempre nulo | Ator = `preferred_username` do token; corpo ignorado | `SegurancaTest`, E2E (`created`/`published`/`rendered_batch` com atores reais) |
| B4 | Sem artefatos de implantação | Imagens não-root, compose de homologação, realm versionado, README | E2E no ambiente em contêineres |
| 5 | CI pulava 6 testes (fixtures) | Job emite fixtures; verificação de zero pulados | `tools/ci/verificar-sem-skips.sh` (prova negativa) |
| 6 | Storage MinIO nunca testado | S3 no CI; testes MinIO rodaram pela 1ª vez contra S3 real | 8 testes de storage verdes |
| 7 | IA como proxy aberto | Autenticação + rate limit por usuário (Redis) | `LimiteDaIaTest` |
| 8 | Payloads retidos para sempre | Payload zerado ao terminar; purga de 30 dias (banco + PDFs) | `RetencaoTest` (5), E2E |
| 9 | Sem limites de requisição/lote | 413 (inclui chunked) e 400 por itens | `LimitesTest` (4), E2E (30 MB → 413) |
| 10 | Schema sem migrations | Flyway V1 baseline + V2; bancos legados migram | `MigracoesTest`, PostgreSQL com V1+V2 |
| 11 | Actuator público | Porta de management interna (8088) | boot real + `SegurancaTest` + E2E |
| 12 | Divergências de stack | Boot 4 segue registrado na nota-005; IA OpenRouter no ADR-014 (inalterados) | — |

## 3. Validação

- **Suítes:** jrxml-core 98/98, designer 138/138, render-service 138/138 com **0 pulados** (SQLite + S3
  real; também em PostgreSQL 16), harness JR 7.0.7 4/4.
- **Boot real do jar:** 8088 serve health/prometheus; 8087 responde 401 ao actuator e à API sem token. Achado
  corrigido: emissor fora do ar respondia 500 e agora responde 401.
- **Ambiente de homologação** (`deploy/docker-compose.homologacao.yml`, 6 serviços saudáveis, só 8080/8180
  expostos): `deploy/e2e-homologacao.sh` passou em todas as verificações com tokens reais. A lista inclui
  401 sem token e com token adulterado, 403 por papel, G7 no preview, ciclo draft → publish, lote pelo
  service account com URLs pré-assinadas, auditoria com atores reais, payload zerado, Flyway, actuator
  inacessível e 413.
- **Navegador real:** SPA com OIDC mostra "Entrar" sem chamar a API; com sessão SSO, o `signinSilent`
  (iframe + PKCE + CSP) autentica sem clique, o cabeçalho mostra o usuário, o render Jasper é chamado com
  Bearer, e localStorage/sessionStorage ficam vazios. A janela de popup em si não pôde ser automatizada
  (fica fora do controle da extensão do navegador); o código do callback de popup é o mesmo da página
  testada.

## 4. Riscos residuais (requisitos de implantação)

1. **Redis privado e com senha:** o compile cache guarda `JasperReport` serializado (ADR-016).
2. **Render-service com egress restrito** e filesystem só com `/app/data` gravável (defesa em
   profundidade além do G7).
3. **URLs pré-assinadas** usam o host de `MINIO_ENDPOINT`, que precisa ser resolvível por quem baixa os
   PDFs.
4. **Imagem S3:** as imagens oficiais da MinIO não são mais publicadas. CI e compose usam
   `pgsty/minio:RELEASE.2026-08-04T00-00-00Z` (rebuild comunitário). **Aprovada pelo responsável em
   2026-11-26**, com a tag fixada; atualizações de versão são deliberadas.
5. **Registry privado** para a imagem do render-service (JAR LGPLv3 embutido, ADR-006).
6. **Audiência do token não é validada:** qualquer client do realm com o papel é aceito. Aceitável num realm
   dedicado; restringir `aud` se o realm for compartilhado.

## 5. Achados fora do escopo (para o backlog da homologação)

- ~~**Preview de etiqueta com EAN13 falha com os dados de exemplo**~~ → **corrigido (2026-11-26):** campos que
  alimentam barcode diretamente recebem valor válido para a simbologia (EAN-13/EAN-8 com dígito verificador
  GS1, I2of5 com nº par de dígitos, Code39 em maiúsculas). Engine real: antes HTTP 500 com "Valid are 0-9
  only", depois HTTP 200 com o PNG da grade.
- **Subreport por codename publicado:** com a recusa de subreport por localização (ADR-016), o elemento
  subreport só funciona quando a expressão entrega o objeto. A resolução `repo:<codename>` fica para um
  change futuro.
- **Bundle do designer** com ~700 kB (aviso do Vite); code-splitting é opcional.
