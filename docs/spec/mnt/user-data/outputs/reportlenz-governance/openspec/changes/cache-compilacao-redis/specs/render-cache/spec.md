# Spec: render-cache (capability) — compile cache compartilhado

## ADDED Requirements

### Requirement: Compilado compartilhado entre instâncias
Com o cache compartilhado ativo, um JRXML compilado por UMA instância SHALL ser reaproveitado pelas
demais via Redis (chave `sha256(jrxml)`), sem recompilar.

#### Scenario: Segunda instância não recompila
- **WHEN** a instância A compila um template e a instância B recebe o MESMO jrxml
- **THEN** B obtém o compilado do Redis sem invocar o compilador

#### Scenario: Hit local não toca o Redis
- **WHEN** a mesma instância repete o mesmo jrxml
- **THEN** o L1 in-memory responde sem ida ao Redis

### Requirement: Degradação sem falha
Indisponibilidade do Redis SHALL degradar para compilação local — nenhum render falha por causa do cache.

#### Scenario: Redis fora do ar
- **WHEN** o Redis está inacessível
- **THEN** `obterOuCompilar` compila localmente e devolve o relatório normalmente
