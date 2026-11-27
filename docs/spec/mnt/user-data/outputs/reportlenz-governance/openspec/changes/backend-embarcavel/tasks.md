# Tasks — backend-embarcavel

- [x] 1.1 ADR-026 (Accepted) + pacote OpenSpec
- [x] 2.1 Maven multi-módulo (parent + render-service movido, comportamento idêntico, suíte verde)
- [x] 2.2 `reportlenz-core`: pipeline/G7/gates sem Spring + fachada `MotorReportLenz` + testes
- [x] 2.3 `reportlenz-spring-boot-starter`: auto-configuração (prefixo de rotas, segurança escopada, registro
      com Flyway isolado, batch/IA/limites por propriedade); render-service vira aplicação fina
- [x] 2.4 `exemplos/host-spring`: aplicação Spring Boot 4 com segurança e Flyway próprios; testes de
      coexistência e uso do `MotorReportLenz`, no CI
- [ ] 3.1 Publicação no Maven Central (sources/javadoc/GPG, job no release.yml) + docs
