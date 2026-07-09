# Tasks — phase-1-render-contract-first

## 1. Serviço de render (Spring Boot)
- [x] 1.1 Bootstrap do serviço; matriz Maven JR 7.0.7 (`jasperreports`, `-pdf`, `-fonts`, `-functions`, `-metadata` + `-jdt`, `-barcode4j`) — ADR-007 validado (nota 004)
- [x] 1.2 Fonte pt-BR embarcada e teste de acentuação (R$, ç, ã) no PDF
- [ ] 1.3 Pipeline compile→fill→export (PDF)

## 2. Preview (round-trip)
- [ ] 2.1 `POST /render/preview` (JRXML + sampleData → PDF/PNG)
- [ ] 2.2 Compile cache por `sha256(jrxml)` (Redis) — ADR-008
- [ ] 2.3 400 se JRXML inválido/contém `<queryString>`

## 3. Contrato de dados (RFC-002)
- [ ] 3.1 `buildInputSchema(DataContract) -> JSON Schema` no `jrxml-core`
- [ ] 3.2 Heurística de agrupamento (objeto aninhado por prefixo; array para detail/tabela)
- [ ] 3.3 Codegen: tipos TS + `record` Java
- [ ] 3.4 Publish Wizard (esboço): gera pacote de integração (schema + snippet Java + registro)

## 4. Validação de payload (run-time)
- [ ] 4.1 Validar payload contra `inputSchema` da versão (Java json-schema-validator)
- [ ] 4.2 422 com lista de violações quando inválido; sem render

## 5. Batch
- [ ] 5.1 `POST /render/batch` (async) + fila + workers idempotentes
- [ ] 5.2 Compile único + fill N (reuso do `.jasper` em cache)
- [ ] 5.3 `GET /render/batch/{jobId}` (status + outputs)
- [ ] 5.4 Saída para storage (S3/MinIO) + links

## 6. Observabilidade
- [ ] 6.1 OTel: spans compile/fill/export separados; métricas (VictoriaMetrics), traces (Tempo), logs (Loki)

## 7. Aceite
- [ ] 7.1 Critérios RFC-003 §8 e RFC-002 §7 verdes
- [ ] 7.2 Preview fiel (mesmo engine da produção) e batch idempotente
