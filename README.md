# ReportLenz

Designer web de templates **JRXML contract-first**. O render roda em Java pela **JasperReports Library
7.0.7**, embarcada num serviço Spring Boot. Os dados chegam por **Push**: um contrato declarativo
(`inputSchema`) recebe payloads já filtrados pelo backend de domínio, e nunca há SQL embutido no
relatório (LGPD, I-2/I-3).

| Módulo | O que é |
|---|---|
| `jrxml-core/` | Núcleo TypeScript headless: parser/serializer do dialeto 7, contrato, validação, gates G1–G6 |
| `jrxml-designer-react/` | Designer (React + Mantine) sobre o core |
| `render-service/` | Backend Java (Spring Boot 4, Java 21), em três módulos: `reportlenz-core` (motor), `reportlenz-spring-boot-starter` (embarcável) e `reportlenz-app` (serviço standalone) |
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

### Testes E2E (ambiente de homologação no ar)

```bash
deploy/e2e-homologacao.sh deploy/.env          # API: tokens reais, papéis, G7, ciclo do template, lote, auditoria
pnpm --dir e2e exec playwright install chromium # uma vez
set -a; . deploy/.env; set +a; pnpm --dir e2e test   # interface: login por popup, preview, publish, G8
```

Os dois criam usuários e clients **temporários** no Keycloak e os removem no fim; os usuários de
homologação não são tocados. O CI roda os dois a cada PR (job `e2e`), com segredos aleatórios.

### Pacotes npm: designer embutível (ADR-025)

O editor e o preview são publicados como componentes React:

- **`@archbase/reportlenz-designer-react`:** `<ReportLenzDesigner>` e `<ReportLenzPreview>`. React e Mantine são
  peers. O README do pacote traz o uso.
- **`@archbase/reportlenz-jrxml-core`:** modelo, parser/serializer JRXML 7, contrato e gates.

A SPA de homologação é ela mesma uma consumidora do componente (`jrxml-designer-react/src/spa/Spa.tsx`).
A aplicação de teste `exemplos/host-react` instala os **tarballs** dos pacotes com npm e roda no E2E
(dois designers e um preview, serviço em outra origem):

```bash
exemplos/host-react/preparar.sh        # pnpm pack + npm install + build
# o Playwright a serve sozinho (webServer, porta 5300); o serviço precisa de REPORTLENZ_CORS_ORIGENS
```

Os pacotes são publicados no escopo **`@archbase`** do npm; a publicação está descrita em
[Publicação](#publicação-npm-e-maven-central).

### Backend Java embarcável (ADR-026)

O ReportLenz também roda **dentro do backend Spring Boot 4 da aplicação**:

| Artefato Maven | Para quê |
|---|---|
| `br.com.archbase:reportlenz-core` | Java puro: `MotorReportLenz` renderiza PDF/PNG de JRXML 7 + payload, com G7, contexto restrito e filtro de classes sempre ligados |
| `br.com.archbase:reportlenz-spring-boot-starter` | Auto-configuração: motor como bean, registro de templates no banco da aplicação, endpoints do designer sob `/reportlenz`, batch e IA |

```xml
<dependency>
  <groupId>br.com.archbase</groupId>
  <artifactId>reportlenz-spring-boot-starter</artifactId>
  <version>0.1.0</version>
</dependency>
```

```java
@Service
class Comprovantes {
    private final MotorReportLenz motor;           // bean do starter
    Comprovantes(MotorReportLenz motor) { this.motor = motor; }

    byte[] pdf(String jrxml, Map<String, Object> payload) {
        return motor.renderizarPdf(jrxml, payload);
    }
}
```

No front, o componente React aponta para o próprio backend:
`<ReportLenzDesigner apiBaseUrl="https://app.empresa.com.br/reportlenz" … />`.

**O starter não interfere na aplicação.**
- A cadeia de segurança, o CORS, o limite de 413 e o tratador de erros valem só sob o prefixo.
- O Flyway roda em instância própria, na tabela `reportlenz_schema_history`, depois do Flyway da
  aplicação.
- Não liga `@EnableScheduling`.
- Se a aplicação não tem cadeia de segurança própria, o starter registra uma equivalente à padrão do
  Spring Boot, porque a nossa desligaria a padrão.

A aplicação de teste `exemplos/host-spring` prova a convivência no CI.

| Propriedade | Padrão | |
|---|---|---|
| `reportlenz.api.prefixo` | `/reportlenz` | rotas do ReportLenz (o render-service standalone usa `""`) |
| `reportlenz.seguranca.modo` | `keycloak` | `keycloak` (JWT + papéis do ADR-017), `aplicacao` (a aplicação protege e concede `reportlenz-*`) ou `desligada` (dev) |
| `reportlenz.seguranca.issuer` / `jwk-set-uri` / `client-id` | — / — / `reportlenz` | realm Keycloak |
| `reportlenz.registro.habilitado` | `true` | registro de templates no `DataSource` da aplicação |
| `reportlenz.batch.habilitado` | `true` | lotes (exige Redis e o registro; sem Redis o boot falha dizendo o que fazer) |
| `reportlenz.assistente.habilitado` | `true` | IA (sem chave OpenRouter responde 503) |
| `reportlenz.cors.origens-permitidas` | vazio | origens do componente React em outra origem |
| `reportlenz.recursos.urls-permitidas` | vazio | prefixos de URL de onde imagens podem vir |
| `reportlenz.storage.provider` | `LOCAL` | saídas do batch: `LOCAL` ou `MINIO` (S3) |
| `reportlenz.migracoes.tabela` | `reportlenz_schema_history` | histórico Flyway do ReportLenz |

Peças do motor, como o cache de compilação e a fonte de subreports, são `@ConditionalOnMissingBean`: a
aplicação pode trocá-las.

A publicação no Maven Central está descrita em [Publicação](#publicação-npm-e-maven-central).

### Publicação (npm e Maven Central)

Uma tag `v<versão>` (ex.: `v0.1.0`) dispara o workflow `release`. A versão publicada é a da tag: os
`package.json` e `pom.xml` são ajustados no runner.

| Job | Publica | Processo seguido |
|---|---|---|
| `npm` | `@archbase/reportlenz-jrxml-core` e `@archbase/reportlenz-designer-react` | o do archbase-react e do linktor-webchat-sdk |
| `maven-central` | `br.com.archbase:reportlenz-core` e `br.com.archbase:reportlenz-spring-boot-starter` | o do archflow |
| `github-release` | notas e instruções de instalação | depois dos dois |

**Proteções dos jobs:**
- Recusam versão já publicada. Os dois registros não aceitam republicar: para corrigir algo, publique
  outra versão.
- Rodam os testes antes de publicar:
  - no npm, o core e o designer;
  - no Maven, o núcleo e a aplicação Spring hospedeira, contra os artefatos achatados.
- O job do npm diagnostica a autenticação (`npm whoami` e acesso ao escopo) antes do publish.
- O job do Maven:
  - usa Maven 3.9 fixo;
  - publica POMs achatados (`flatten`, modo `ossrh`), sem o `reportlenz-parent`;
  - só sobe os módulos com `reportlenz.publish.skip=false`, além do `-pl`.

**Antes da primeira vez:**

1. **Namespace `br.com.archbase`:** é o dos artefatos do Archbase, já verificado no Central. O token
   (`MAVEN_CENTRAL_*`) precisa ser da conta dona desse namespace.
2. **Segredos** neste repositório, com os mesmos valores dos outros projetos:

   ```bash
   gh secret set NPM_TOKEN               # o do archbase-react (publica em @archbase)
   gh secret set MAVEN_CENTRAL_USERNAME  # os do archflow
   gh secret set MAVEN_CENTRAL_TOKEN
   gh secret set GPG_PRIVATE_KEY         # chave privada em base64
   gh secret set MAVEN_GPG_PASSPHRASE
   ```
3. **Ensaio no Central:** rodar o workflow **Central Dry Run** (Actions → Run workflow). Ele valida o
   bundle sem publicar. Depois, descarte o deployment no portal (Drop).
4. **Publicar:** `git tag -a v0.1.0 -m "ReportLenz 0.1.0" && git push origin v0.1.0`.

### Catálogo de modelos e matriz de testes (ADR-022)

A galeria tem 14 modelos, todos definidos em `jrxml-core/src/reference/`:

| Família | Modelos |
|---|---|
| Fiscais e cobrança | fatura, boleto, DANFE, orçamento |
| Operação | comprovante, formulário |
| Gerenciais | listagem de vendas, extrato de conta |
| Etiquetas e crachás | etiqueta A4, etiqueta de produto com QR, etiqueta de endereçamento, crachá |
| Cartas e documentos | carta/declaração, contrato |

Cada modelo declara **cenários** em `reference/cenarios.ts`: típico, mínimo, volume e textos longos, cada
um com o que o render deve produzir. Todas as camadas percorrem o catálogo inteiro sem teste por modelo:

- **core:** gates G1–G6 e payload × inputSchema;
- **engine:** `MatrizDoCatalogoTest`, que confere PDF e páginas e lê os códigos de barras com ZXing;
- **harness:** G1;
- **E2E:** preview, publish e regressão visual.

Para conferir os layouts à mão, grave a 1ª folha de cada cenário:
`mvn test -Dtest=MatrizDoCatalogoTest -Dmatriz.png=/tmp/png`.

Mudou o layout de propósito? Com o ambiente no ar, regenere as imagens de referência do E2E e revise o
diff no PR:

```bash
set -a; . deploy/.env; set +a; pnpm --dir e2e atualizar-referencias
```

DV do boleto, fator de vencimento e chave da NF-e são calculados pelo backend de domínio e chegam prontos
no payload: o template só os desenha.

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
