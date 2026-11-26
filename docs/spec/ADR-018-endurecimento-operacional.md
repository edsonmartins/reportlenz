# ADR-018 — Endurecimento operacional: retenção LGPD, limites, rate limit da IA e migrations versionadas

- **Status:** Accepted (retenção decidida pelo usuário em 2026-11-26: "apagar ao concluir + purga 30d")
- **Data:** 2026-11-26
- **Relacionado:** I-2 (LGPD), ADR-009 (persistência/SQL portável), ADR-014 (IA OpenRouter), ADR-017 (ator
  do token), RFC-003 §4/§7, RFC-006 §4
- **Implementa:** `openspec/changes/endurecimento-operacional`

## Contexto

Itens 5–11 da auditoria de homologação (2026-11-26):

- payloads de clientes (dados pessoais) ficam em `render_job.payloads` **para sempre**, e os PDFs gerados
  também ficam no storage sem prazo;
- não há limite de tamanho de requisição nem de itens por lote;
- `/assist/**` chama um provedor pago sem limite de uso;
- o schema é aplicado por `schema.sql` com `spring.sql.init.mode=always`, sem versionamento — a próxima
  mudança de tabela não tem caminho de migração;
- o tracing amostra 100% por padrão;
- o CI pula sem aviso 6 testes que dependem dos fixtures do harness e 2 que dependem de MinIO.

## Decisão

1. **Retenção (LGPD):**
   - quando o job termina (`done` ou `failed`, incluindo poison cap), `render_job.payloads` vira `[]`; os
     PDFs e o estado do job continuam disponíveis;
   - uma purga diária (`REPORTLENZ_RETENCAO_CRON`, default `0 30 3 * * *`) apaga jobs **terminados** há
     mais de `REPORTLENZ_RETENCAO_DIAS` (default **30**): as linhas de `render_job_saida`, as de
     `render_job` e os PDFs no storage (LOCAL e MinIO);
   - a auditoria de templates (`report_template_audit`) **não** é purgada, porque é a trilha da LGPD e só
     guarda metadados (jobId, contagem, chave), nunca payload;
   - jobs `queued`/`running` nunca são purgados.
2. **Limites:**
   - corpo de requisição limitado a `REPORTLENZ_MAX_REQUEST_MB` (default **25**) → **413
     `REQUISICAO_GRANDE_DEMAIS`**, valendo também para corpo chunked sem Content-Length;
   - lote limitado a `REPORTLENZ_BATCH_MAX_ITENS` (default **20000**, acima do exemplo de 17000 da
     RFC-003) → **400 `LOTE_GRANDE_DEMAIS`**.
3. **Rate limit da IA por usuário:** janela fixa de 1 minuto no Redis (chave = ator do token, ADR-017),
   `REPORTLENZ_ASSIST_LIMITE_POR_MINUTO` (default **10**) → **429 `IA_LIMITE_EXCEDIDO`** com `Retry-After`.
   Usar o Redis faz o limite valer entre instâncias. Se o Redis falhar, a chamada passa (fail-open): o
   limite protege custo, não segurança.
4. **Migrations versionadas com Flyway:** `V1__baseline.sql` com o DDL atual (portável SQLite/PostgreSQL,
   `IF NOT EXISTS` — bancos existentes migram sem baseline manual) e `V2__indice_retencao.sql` (índice para
   a purga). `spring.sql.init` é desligado.
5. **Sampling de tracing:** default `OTEL_SAMPLING=0.1`.
6. **CI sem pulos silenciosos:** o job `render-service` gera os fixtures (Node + pnpm) e sobe um MinIO; um
   passo final falha se algum teste foi pulado.

## Alternativas consideradas

- **Purga só por idade, sem limpar payload ao concluir:** permitiria reprocessar, mas mantém dados
  pessoais sem necessidade; o reprocessamento já existe reenviando a `idempotencyKey`.
- **Rate limit em memória:** não vale com várias instâncias.
- **Liquibase:** mais pesado; Flyway com SQL puro preserva o SQL portável do ADR-009.

## Consequências

- Reenviar a mesma `idempotencyKey` depois da purga cria um job **novo** (a chave foi liberada). Isso é o
  esperado: o resultado anterior já expirou.
- A consulta de status de job purgado responde 404.
- Novas tabelas e colunas passam a entrar como `V<n>__*.sql`.
