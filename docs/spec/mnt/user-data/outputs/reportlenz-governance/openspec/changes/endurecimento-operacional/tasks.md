# Tasks — endurecimento-operacional

- [x] 1.1 ADR-018 + pacote OpenSpec (proposal/spec/tasks)
- [x] 2.1 Flyway: V1__baseline (DDL atual) + V2 índice; desligar spring.sql.init; teste de banco legado
- [x] 2.2 Retenção: zerar payloads ao terminar (done/failed/poison) + PurgaDeRetencao agendada (banco +
      storage LOCAL/MinIO); testes
- [x] 2.3 Limites: filtro de tamanho de corpo (413, inclui chunked) + máx itens por lote (400); testes
- [x] 2.4 Rate limit da IA por usuário (Redis, janela de 1 min, 429 + Retry-After, fail-open); testes
- [x] 2.5 Sampling default 0.1
- [ ] 3.1 CI: fixtures + MinIO no job render-service; passo que falha com testes pulados; validar local
