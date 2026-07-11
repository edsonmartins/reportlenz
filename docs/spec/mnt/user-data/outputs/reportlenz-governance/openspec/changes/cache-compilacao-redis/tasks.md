# Tasks — cache-compilacao-redis

- [x] 1.1 `CacheDeCompilacaoCompartilhado` (L1 LRU + L2 Redis bytes `.jasper`, TTL; degrade sem falha)
- [x] 1.2 Wiring condicional (`REPORTLENZ_COMPILE_CACHE_COMPARTILHADO`, default true) + config yml
- [x] 1.3 Testes: 2ª instância sem recompilar · hit L1 sem Redis · degrade com Redis fora
