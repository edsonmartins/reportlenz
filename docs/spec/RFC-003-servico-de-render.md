# RFC-003 — Serviço de render (preview + batch)

- **Status:** Draft
- **Fase:** 1
- **Relacionado:** ADR-001, ADR-007, ADR-008, RFC-002
- **Implementa:** `openspec/changes/phase-1-render-contract-first`

## 1. Objetivo

Especificar o serviço de render em **Spring Boot**, que embarca a JasperReports Library 7.0.7 (ADR-007).
Ele expõe (a) o endpoint de **preview** do round-trip (ADR-008) e (b) o endpoint de **batch** assíncrono
para produção em lote (ex.: 17k comprovantes Rio Quality). É o mesmo engine para os dois — sem trabalho
duplicado.

## 2. Topologia

```
[Designer UI] --JRXML+payload exemplo--> POST /render/preview --> PDF/PNG (sync)
[Gatilho]     --templateId+versão+payloads--> POST /render/batch --> jobId (async)
                                              GET  /render/batch/{jobId} --> status/links
```

O Spring **monta o datasource** a partir do payload (modo Push, ADR-003), **valida contra o contrato**
(RFC-002) e chama o engine. Nunca há query embutida.

## 3. Pipeline de render (Java)

```
1. Resolver versão do template (JRXML + inputSchema) — PostgreSQL (ADR-009)
2. Validar payload contra inputSchema (RFC-002) — 422 se inválido
3. Compilar: .jasper = JasperCompileManager.compileReport(jrxml)
   - Compile cache por sha256(jrxml) (ADR-008) — Redis/in-memory
4. Montar datasource: JRBeanCollectionDataSource / Map (Push)
5. Preencher: JasperFillManager.fillReport(.jasper, params, datasource)
6. Exportar: jasperreports-pdf -> PDF (ou PNG por página p/ preview)
```

## 4. Contratos de endpoint

### `POST /render/preview` (sync)
```jsonc
// request
{
  "jrxml": "<jasperReport ...>...</jasperReport>",   // ou templateId+version
  "sampleData": { /* payload que satisfaz o contrato */ },
  "format": "pdf" | "png"                             // png p/ painel lado a lado
}
// response: 200 application/pdf  (ou image/png multi-página)
// 422 se sampleData não satisfaz o contrato
// 400 se JRXML inválido (XSD) ou contém <queryString> (anti-Pull)
```

### `POST /render/batch` (async)
```jsonc
// request
{
  "templateId": "uuid",
  "version": 3,
  "payloads": [ { /* item 1 */ }, { /* item 2 */ }, ... ],  // ou referência a uma fonte de payloads
  "idempotencyKey": "rq-comprovantes-2026-06-28"
}
// response: 202 { "jobId": "uuid" }
```
- Enfileira N jobs; workers processam **assíncrono e idempotente** (chave por job).
- Compile cache compartilhado: compila o template uma vez, preenche N vezes.

### `GET /render/batch/{jobId}`
```jsonc
{ "jobId":"uuid", "status":"queued|running|done|failed",
  "total":17000, "done":17000, "outputs":[ "s3://.../1.pdf", ... ] }
```

## 5. Compile cache (ADR-008)

- Chave: `sha256(jrxml)` (= `jrxml_hash` da versão, ADR-009).
- Valor: bytes do `.jasper` compilado.
- Store: Redis (compartilhado entre instâncias) com TTL + invalidação on publish.
- Recompila só quando o template muda; preview com dados variados não recompila.

## 6. Segurança / LGPD

- Validação de payload contra contrato **antes** de qualquer render (RFC-002).
- Nenhum acesso a fonte de dados na origem: o backend recebe payload já filtrado (I-2). Quem monta o
  payload (filtrando o que pode sair) é a aplicação de domínio, **a montante** deste serviço.
- Engine 7.0.7 traz o filtro de desserialização da CVE-2025-10492 (ADR-002).

## 7. Observabilidade

OpenTelemetry em todo o pipeline; métricas de tempo de compile vs. fill vs. export (VictoriaMetrics);
traces (Tempo); logs (Loki). Atribuição de tempo separada para diagnosticar latência (compile dominante).

## 8. Critérios de aceite

- Preview retorna PDF/PNG fiel (mesmo engine da produção).
- Batch de N processa assíncrono, idempotente, com compile único.
- 422 para payload fora do contrato; 400 para JRXML com `<queryString>`.
- Compile cache reduz latência de preview repetido (hit no segundo render).
