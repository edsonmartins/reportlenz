# Spec: operacao (capability) — retenção, limites, rate limit e migrations

## ADDED Requirements

### Requirement: Payload não sobrevive ao job
O serviço SHALL substituir `render_job.payloads` por `[]` quando o job termina (`done` ou `failed`).

#### Scenario: Lote concluído
- **WHEN** um lote termina
- **THEN** os payloads gravados viram `[]` e o status/saídas continuam consultáveis

#### Scenario: Mensagem venenosa
- **WHEN** um job é marcado `failed` pelo poison cap
- **THEN** os payloads também são zerados

### Requirement: Purga por prazo de retenção
Uma rotina diária SHALL apagar jobs terminados há mais de `REPORTLENZ_RETENCAO_DIAS` (default 30): linhas de
saída, a linha do job e os PDFs no storage. Jobs em andamento e a auditoria de templates não são apagados.

#### Scenario: Job expirado
- **WHEN** a purga roda e há um job `done` atualizado há 31 dias
- **THEN** o job, as saídas e os arquivos somem e `GET /render/batch/{id}` responde 404

#### Scenario: Job em andamento antigo
- **WHEN** há um job `running` atualizado há 31 dias
- **THEN** a purga não o apaga

### Requirement: Limites de requisição e de lote
O serviço SHALL responder 413 `REQUISICAO_GRANDE_DEMAIS` a corpos acima de `REPORTLENZ_MAX_REQUEST_MB` e 400
`LOTE_GRANDE_DEMAIS` a lotes com mais de `REPORTLENZ_BATCH_MAX_ITENS` itens.

#### Scenario: Corpo grande demais
- **WHEN** chega um corpo maior que o limite (com ou sem Content-Length)
- **THEN** a resposta é 413 e nada é processado

#### Scenario: Lote acima do limite
- **WHEN** um lote traz mais itens que o limite
- **THEN** a resposta é 400 `LOTE_GRANDE_DEMAIS` e nenhum job é criado

### Requirement: Rate limit da IA por usuário
`/assist/**` SHALL aceitar até `REPORTLENZ_ASSIST_LIMITE_POR_MINUTO` chamadas por usuário por minuto,
contadas no Redis.

#### Scenario: Usuário excede o limite
- **WHEN** um usuário faz a chamada N+1 dentro do mesmo minuto
- **THEN** a resposta é 429 `IA_LIMITE_EXCEDIDO` com `Retry-After`, sem chamar o provedor

#### Scenario: Outro usuário não é afetado
- **WHEN** o usuário A estourou o limite e o usuário B chama
- **THEN** a chamada de B segue normalmente

### Requirement: Schema por migrations versionadas
O schema SHALL ser aplicado pelo Flyway (`db/migration/V*`), em SQLite e PostgreSQL, inclusive sobre bancos
criados pelo antigo `schema.sql`.

#### Scenario: Banco legado
- **WHEN** o serviço sobe sobre um banco com as tabelas do `schema.sql` e sem histórico do Flyway
- **THEN** as migrations aplicam sem erro e os dados permanecem

### Requirement: CI sem testes pulados
O CI SHALL executar os testes dependentes dos fixtures e do MinIO e falhar se algum teste for pulado.

#### Scenario: Fixture ausente
- **WHEN** um teste do render-service seria pulado por falta de fixture ou de MinIO
- **THEN** o job do CI falha
