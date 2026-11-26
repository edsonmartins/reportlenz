# ReportLenz

Designer web de templates **JRXML contract-first**. O render roda em Java pela **JasperReports Library
7.0.7**, embarcada num serviço Spring Boot. Os dados chegam por **Push**: um contrato declarativo
(`inputSchema`) recebe payloads já filtrados pelo backend de domínio, e nunca há SQL embutido no
relatório (LGPD, I-2/I-3).

| Módulo | O que é |
|---|---|
| `jrxml-core/` | Núcleo TypeScript headless: parser/serializer do dialeto 7, contrato, validação, gates G1–G6 |
| `jrxml-designer-react/` | Designer (React + Mantine) sobre o core |
| `render-service/` | Preview, batch, publish, registro de templates e IA (Spring Boot 4, Java 21) |
| `tools/jr7-harness/` | Gate G1: o JRXML emitido precisa carregar e compilar na Library real |
| `deploy/` | Ambiente de homologação (compose, realm Keycloak) |
| `docs/spec/` | Constituição, ADRs, RFCs e change packages (OpenSpec) |

---

## Desenvolvimento local

Pré-requisitos: Node 24 + pnpm 9, Java 21 + Maven 3.9, Redis em `localhost:6379`.

```bash
pnpm install
pnpm --dir jrxml-core build && pnpm --dir jrxml-core emit:fixtures   # fixtures do harness/testes

# render-service SEM autenticação (só dev local; ADR-017 §5) e SQLite em data/
cd render-service
REPORTLENZ_SEGURANCA_HABILITADA=false mvn spring-boot:run              # API :8087 · actuator :8088

# designer (outro terminal): Vite em :5187 com proxy para :8087; public/config.json = {"oidc": null}
pnpm ui:dev
```

Testes:

```bash
pnpm core:test && pnpm ui:test
cd render-service && mvn test             # precisa de Redis; PostgreSQL: REPORTLENZ_DB_URL=jdbc:postgresql://...
# testes de storage contra S3 real: MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY
tools/ci/verificar-sem-skips.sh           # falha se algum teste foi pulado (o CI exige zero)
```

---

## Homologação (contêineres)

```bash
cp deploy/.env.exemplo deploy/.env        # troque TODOS os "troque-*"
docker compose -f deploy/docker-compose.homologacao.yml --env-file deploy/.env up -d --build
```

| Endereço | Serviço |
|---|---|
| http://localhost:8080 | Designer (SPA + proxy reverso da API) |
| http://localhost:8180 | Keycloak (realm `reportlenz`; console admin com `KEYCLOAK_ADMIN_*`) |

Render-service, actuator, PostgreSQL, Redis e MinIO ficam **só na rede interna** do compose.

**Usuários de teste** (senha temporária do `.env`, troca obrigatória no 1º login):

- `designer.homolog`: papel `reportlenz-designer` (preview, IA, verificar, salvar draft);
- `publicador.homolog`: papéis designer + `reportlenz-publicador` (publicar, deprecar).

**Backend de domínio (batch):** client confidencial `reportlenz-batch` com o papel `reportlenz-batch`.

```bash
TOKEN=$(curl -s -d grant_type=client_credentials -d client_id=reportlenz-batch \
  -d client_secret="$REPORTLENZ_BATCH_CLIENT_SECRET" \
  http://localhost:8180/realms/reportlenz/protocol/openid-connect/token | jq -r .access_token)
curl -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"templateCodename":"fatura","payloads":[{...}],"idempotencyKey":"lote-001"}' \
  http://localhost:8080/render/batch
```

Azure AD entra como *identity provider* do realm (configuração do Keycloak; o serviço só confia no
Keycloak).

### Imagens

```bash
docker build -t reportlenz-render render-service
docker build -f jrxml-designer-react/Dockerfile -t reportlenz-designer .
```

Ambas rodam sem root. **Publique só em registry privado:** a imagem do render-service embute o JAR da
JasperReports Library (LGPLv3) para uso server-side interno (ADR-006/ADR-019).

---

## Configuração do render-service

| Variável | Default | Descrição |
|---|---|---|
| `REPORTLENZ_SEGURANCA_HABILITADA` | `true` | `false` só em dev local (libera tudo, ator `dev-local`) |
| `REPORTLENZ_OIDC_ISSUER` | — | Issuer **público** do realm. Obrigatório com segurança habilitada (fail-closed) |
| `REPORTLENZ_OIDC_JWK_SET_URI` | discovery | JWKS pela rede interna; o `iss` continua validado (ADR-019) |
| `REPORTLENZ_OIDC_CLIENT_ID` | `reportlenz` | Client cujos client roles também valem como papéis |
| `REPORTLENZ_MANAGEMENT_PORT` | `8088` | Actuator (health, prometheus): só rede interna |
| `REPORTLENZ_DB_URL` / `_USER` / `_PASSWORD` / `_POOL` | SQLite em `data/` | PostgreSQL em homologação/produção (Flyway migra no boot) |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | `localhost` / `6379` / — | Fila, compile cache, rate limit da IA |
| `REPORTLENZ_STORAGE_PROVIDER` | `LOCAL` | `MINIO` em homologação/produção |
| `MINIO_ENDPOINT` / `_ACCESS_KEY` / `_SECRET_KEY` / `MINIO_BUCKET` | — | S3 das saídas; URLs pré-assinadas na consulta do job |
| `REPORTLENZ_RECURSOS_URLS_PERMITIDAS` | vazio | Prefixos de URL que imagens podem buscar (ADR-016) |
| `REPORTLENZ_RETENCAO_DIAS` / `_CRON` | `30` / `0 30 3 * * *` | Purga de jobs terminados: banco + PDFs (ADR-018) |
| `REPORTLENZ_MAX_REQUEST_MB` | `25` | Corpo máximo (413) |
| `REPORTLENZ_BATCH_MAX_ITENS` | `20000` | Itens por lote (400) |
| `REPORTLENZ_ASSIST_LIMITE_POR_MINUTO` | `10` | Chamadas à IA por usuário/minuto (429); `0` = sem limite |
| `OPENROUTER_API_KEY` / `REPORTLENZ_LLM_*` | — | IA (ADR-014); sem chave o assistente responde 503 |
| `OTEL_SAMPLING` / `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | `0.1` / localhost | Tracing OTLP |

Papéis (realm roles ou client roles de `REPORTLENZ_OIDC_CLIENT_ID`):

| Papel | Endpoints |
|---|---|
| `reportlenz-designer` | `POST /render/preview`, `/assist/**`, `/publish/verificar`, `POST /templates/{c}/versoes`, `GET /templates/**` |
| `reportlenz-publicador` | `POST /templates/{c}/versoes/{v}/publicar` e `/deprecar`, `GET /templates/**` |
| `reportlenz-batch` | `POST /render/batch`, `GET /render/batch/{id}` |

---

## Segurança e operação

- **Expressões sob allowlist (G7, ADR-016):** expressões JR são Java compilado. O serviço só aceita o
  vocabulário de valor e recusa o resto com `EXPRESSAO_PROIBIDA` (preview) ou com o G7 vermelho (publish).
  Arquivos locais e URLs fora da lista são recusados no fill.
- **Subreport só por template publicado (ADR-020):** a expressão é o literal `"repo:<codename>"` (versão
  publicada atual) ou `"repo:<codename>@<n>"` (versão fixa). O gate **G8** bloqueia o publish se o filho não
  estiver publicado ou se houver ciclo. Publique o filho antes do pai (ex.: `fatura_entregas` antes de `fatura`).
- **Filtro de classes do engine (ADR-021):** segunda barreira, no fill. Classe fora da whitelist em
  `render-service/src/main/resources/jasperreports.properties` falha com "Class X is not visible to reports".
  Tipo novo no G7 precisa entrar nessa whitelist; o `FiltroDeClassesTest` cobra essa paridade.
- **Batch só de template publicado:** `jrxml` bruto no lote dá 400 `JRXML_BRUTO_PROIBIDO`.
- **Auditoria:** o ator é sempre o usuário do token (`preferred_username`), nunca o corpo da requisição.
- **LGPD:** o payload é zerado quando o job termina; jobs e PDFs são purgados após 30 dias. A auditoria de
  templates guarda só metadados.

**Riscos residuais (requisitos de implantação):**

1. **Redis privado e com senha.** O compile cache guarda `JasperReport` serializado. O filtro de classes do
   engine (ADR-021) impede que um relatório adulterado execute código fora da whitelist, mas o conteúdo do
   relatório ainda pode ser trocado.
2. **Render-service sem privilégios e com egress restrito** (defesa em profundidade além do G7): usuário
   não-root (já na imagem), filesystem só com `/app/data` gravável e saída de rede só para Keycloak,
   Redis, PostgreSQL, S3, o provedor de IA e os prefixos de imagem liberados.
3. **URLs pré-assinadas usam o host de `MINIO_ENDPOINT`.** Quem baixa os PDFs (o backend de domínio)
   precisa resolver esse host. No compose de homologação, `minio:9000` só é visível dentro da rede.
4. **Imagem do S3:** as imagens oficiais da MinIO deixaram de ser publicadas. `MINIO_IMAGE` usa
   `pgsty/minio` (rebuild comunitário), **aprovada pelo responsável em 2026-11-26**. Mantenha a tag
   fixada e atualize-a de forma deliberada (sem `latest`).
