# Change: backend-embarcavel

## Why
Importar o ReportLenz nos backends Java (Spring Boot 4) das aplicações: renderizar por uma API Java e
servir o componente React (ADR-025) pelo próprio backend. Pedido do usuário em 2026-11-27 (ADR-026).

## What Changes
- Maven multi-módulo:
  - `reportlenz-core`: Java puro, com a fachada `MotorReportLenz`;
  - `reportlenz-spring-boot-starter`: auto-configuração;
  - `render-service`: aplicação fina sobre o starter.
- Starter coexistindo com a aplicação:
  - rotas sob prefixo;
  - cadeia de segurança escopada;
  - Flyway isolado;
  - batch, IA e limites com propriedades e falha clara sem infraestrutura.
- Aplicação Spring hospedeira de teste no CI.
- Publicação no Maven Central pelo `release.yml`.

## Impact
- Affected specs: `backend-embarcavel` (nova).
- Affected code: `render-service/`, que vira `backend/` multi-módulo; Dockerfile; CI; `exemplos/host-spring`.
