# Nota de design 005 — Aceite da Fase 1 (`phase-1-render-contract-first`)

- **Data:** 2026-07-10
- **Tarefas:** phase-1/7.1, phase-1/7.2
- **Relacionado:** RFC-002 §7, RFC-003 §8, ADR-007/008/009, notas 004

## Veredito

**Fase 1 concluída.** Auditoria de 2026-07-10: 83 testes Vitest (jrxml-core) + 28 testes JUnit
(render-service, 1 skip = integração MinIO opt-in, executada com credenciais reais em 2026-07-09) +
harness 4/4 na Library 7.0.7 + `javac` dos records gerados. Infra validada de verdade: Redis local,
MinIO da infra (bucket `reportlenz-saidas` criado), SQLite.

## Critérios RFC-003 §8 × evidência

| Critério | Evidência |
|---|---|
| Preview retorna PDF/PNG fiel (mesmo engine da produção) | `PreviewControllerTest` (PDF `%PDF`, PNG multi-página com `X-Total-Pages`); fidelidade por CONSTRUÇÃO: preview e batch usam o MESMO `PipelineDeRender`/Library 7.0.7 (I-8) |
| Batch de N assíncrono, idempotente, compile único | `BatchFlowTest`: 3 payloads → 3 PDFs reais no storage com `compilar()` 1× (spy); idempotência de lote (UNIQUE `idempotency_key` → mesmo jobId) e de item (PK `job_id+idx`) |
| 422 payload fora do contrato; 400 JRXML com queryString | 422 `PAYLOAD_FORA_DO_CONTRATO` com violações e `verify(never)` no compilador; 400 `CONTRACT_PULL_FORBIDDEN` (as 3 formas de Pull) e `JRXML_INVALIDO` |
| Compile cache reduz latência de preview repetido | Cenário do spec: 2 previews do mesmo template = 1 compilação (spy) + métrica `render.compilacao` = 1 vs `render.fill` = 2 (`ObservabilidadeTest`) |

## Critérios RFC-002 §7 × evidência

| Critério | Evidência |
|---|---|
| `buildInputSchema` produz JSON Schema válido | Exemplo canônico do §2 reproduzido com igualdade profunda (`inputSchema.test.ts`); **teste cruzado** `ContratoCruzadoTest`: o schema emitido pelo core TS é carregado e APLICADO pelo networknt do serviço Java |
| Validação de payload recusa objeto fora do contrato (422) | `ValidadorDePayloadTest` (violações acumuladas com caminho) + endpoint 422 |
| Codegen TS e Java compiláveis | TS: compilador TypeScript real em memória (strict; payload inválido NÃO compila); Java: `javac` dos 4 `{Nome}Payload.java` no CI |
| Nenhum caminho do contrato envolve query/conexão | Por construção no modelo + testes de ausência em schema/tipos/records/snippet/pacote |

## 7.2 — Preview fiel e batch idempotente

- **Fiel:** um único pipeline (`PipelineDeRender`) serve preview e batch — não existem dois caminhos
  de render para divergirem (ADR-008/I-8).
- **Idempotente:** reenvio com a mesma `idempotencyKey` devolve o MESMO jobId sem reenfileirar
  (cenário do spec: 2 saídas antes e depois); reprocessamento pula itens já concluídos.

## Decisões de infra (usuário, 2026-07-09)

Fila = **Redis** (env `REDIS_*`; infra 192.168.1.110) · Estado = **SQLite** (PostgreSQL quando o
registro ADR-009 crescer) · Storage = **padrão MEDIASTORE** (LOCAL + MINIO SDK v2 path-style,
validado contra o MinIO real) · Observabilidade = Prometheus scrape (VictoriaMetrics) + OTLP (Tempo).

## Pendências herdadas pela Fase 2+

- **Registro de templates (ADR-009):** o batch aceita `jrxml`+`inputSchema` inline; `templateId`+
  `version` + PostgreSQL entram quando o repositório de templates nascer (RFC-006).
- Compile cache Redis compartilhado (multi-instância) atrás da interface `CacheDeCompilacao`.
- Presigned URLs no MinIO (hoje a referência é `s3://` ou `publicBaseUrl`).
- Fila com consumer groups (Redis Streams) se o worker precisar de at-least-once forte.

## Armadilhas Boot 4/JR7 catalogadas nesta fase

MockMvc em `spring-boot-webmvc-test` (pacote novo) · JSON default é Jackson 3 (`tools.jackson`) ·
endpoint Prometheus exige `spring-boot-starter-micrometer-metrics` · `application.yml` de teste faz
sombra ao principal · load JR7 lança `JacksonRuntimeException` unchecked · fill MUTA o mapa de
parâmetros · AWS SDK v2 sem http client default (`apache-client` explícito).
