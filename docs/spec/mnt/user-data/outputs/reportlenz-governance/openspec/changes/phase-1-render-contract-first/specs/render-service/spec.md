# Spec: render-service (capability)

## ADDED Requirements

### Requirement: Preview por render real (round-trip)
O serviço SHALL expor `POST /render/preview` que renderiza um JRXML com dados de exemplo usando a
JasperReports Library 7.0.7, retornando PDF ou PNG — o mesmo engine da produção (ADR-008).

#### Scenario: Preview válido
- **WHEN** `POST /render/preview` recebe JRXML válido + `sampleData` que satisfaz o contrato
- **THEN** retorna 200 com PDF (ou PNG por página)

#### Scenario: Preview com JRXML Pull
- **WHEN** o JRXML contém `<queryString>`
- **THEN** retorna 400 (anti-Pull, ADR-003), sem render

### Requirement: Compile cache
O serviço SHALL cachear o relatório compilado por `sha256(jrxml)`, recompilando apenas quando o template
muda (ADR-008).

#### Scenario: Segundo preview do mesmo template
- **WHEN** dois previews do mesmo JRXML com dados diferentes são solicitados
- **THEN** a compilação ocorre uma vez (cache hit no segundo) e o fill ocorre nas duas

### Requirement: Validação de payload contra contrato
O serviço SHALL validar o payload contra o `inputSchema` da versão antes de preencher; payload inválido
não renderiza.

#### Scenario: Payload fora do contrato
- **WHEN** o payload não satisfaz o `inputSchema`
- **THEN** retorna 422 com a lista de violações
- **AND** nenhum render é executado

### Requirement: Batch assíncrono idempotente
O serviço SHALL expor `POST /render/batch` que processa N payloads de forma assíncrona e idempotente,
compilando o template uma vez.

#### Scenario: Lote de N comprovantes
- **WHEN** `POST /render/batch` recebe `templateId`, `version`, N payloads e `idempotencyKey`
- **THEN** retorna 202 com `jobId`
- **AND** os N documentos são gerados com compilação única e reprocessamento idempotente

#### Scenario: Reenvio com mesma idempotencyKey
- **WHEN** o mesmo lote é reenviado com a mesma `idempotencyKey`
- **THEN** não são gerados documentos duplicados
