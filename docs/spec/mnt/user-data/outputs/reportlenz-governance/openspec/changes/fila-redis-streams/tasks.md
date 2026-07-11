# Tasks — fila-redis-streams

- [x] 1.1 FilaDeRender sobre Streams: XADD/XREADGROUP/XACK, grupo idempotente, consumidor único
      por instância, reivindicação de pendentes (idle configurável) com contagem de entregas
- [x] 1.2 ProcessadorDeLote: confirmar SÓ após processar; poison cap (entregas > N → failed + ack)
- [x] 1.3 Testes: worker morto → outra instância reivindica e processa · poison cap · fluxo BatchFlow
      intacto (isolamento por execução no yml de teste)
